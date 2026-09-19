/* ---------------------------------------------------------------
   Admin dashboard: houses (lock status, password set or not, Lord
   assignment) and submitted applications ("tickets"), gated by the
   same ADMIN_SECRET every other admin action already uses.

   The secret is kept in this module-scope variable only — never
   localStorage/sessionStorage — so it disappears the moment the page
   is closed or reloaded, same as the rest of this site's "don't
   persist sensitive things" pattern.
------------------------------------------------------------------ */
let adminSecret = null;
let currentAdmin = null;
let allHouses = [];
let allApplications = [];
let allStaff = [];
let allDiscordUsers = [];
let closedDepartments = [];
let closedDepartmentDetails = [];

// Applications hold fully public, unauthenticated free text (anyone can
// submit one) that ends up rendered inside a privileged admin session that
// holds the admin secret in memory — so every submitted field gets escaped
// before it touches innerHTML, unlike some of the site's other, lower-stakes
// user text.
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const CHEVRON_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;
const LOCK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/></svg>`;
const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/></svg>`;
const CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
const UNLOCK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 017.8-1.3"/></svg>`;
const KEY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5L19 4M19 4v3.5M19 4h-3.5"/></svg>`;
const CROWN_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l3.5 3L12 5l4.5 6L20 8l-1.6 9H5.6L4 8z"/></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-8 0l1 12a2 2 0 002 2h4a2 2 0 002-2l1-12"/></svg>`;
const DOWNLOAD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"/></svg>`;
const PLUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`;
const WARNING_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4L3 20h18L12 4z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>`;
const HOUSE_TAB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z"/></svg>`;
const CLIPBOARD_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4.5" width="12" height="16" rx="2"/><path d="M9 4.5V4a1 1 0 011-1h4a1 1 0 011 1v.5M9 11h6M9 15h6"/></svg>`;
const DISCORD_TAB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8.5" r="3.2"/><path d="M4.5 20c0-3.5 3.2-6 7.5-6s7.5 2.5 7.5 6"/></svg>`;
const STAFF_TAB_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M2.5 19c0-3 2.9-5.2 6.5-5.2s6.5 2.2 6.5 5.2"/><path d="M16 4.5a3 3 0 010 6M18.5 13.8c2.4.5 4 2.3 4 5.2"/></svg>`;
const WRENCH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 00-5.4 4.6L4 16.2V20h3.8l5.3-5.3a4 4 0 004.6-5.4l-2.6 2.6-2-2z"/></svg>`;

function copyBtnHtml(value, label) {
  return `<button type="button" class="ticket-copy-btn" data-copy="${escapeHtml(value)}" title="Copy ${label}" aria-label="Copy ${label}">${COPY_ICON}</button>`;
}

// Crown Orders aren't "Houses" and don't have "Lords" — each has its own
// title for the person recognized via Discord ID/role. Real noble houses
// keep the default "Lord".
const LEADER_TITLES = { "faith-militant": "High Septon", "city-watch": "Lord Commander", kingsguard: "Lord Commander", dragonguard: "Lord Commander" };
function leaderTitle(h) {
  return LEADER_TITLES[h.slug] || "Lord";
}
function entityLabel(h) {
  return h.faction === "CROWN" ? h.name : `House ${h.name}`;
}

function adminHeaderHtml() {
  return `
    <div class="admin-header">
      <div>
        <div class="admin-kicker">Internal tool</div>
        <h1>Admin dashboard</h1>
        <p>House locks and leadership assignments, submitted applications, and site maintenance. Not linked from the public site.</p>
      </div>
      ${
        currentAdmin
          ? `<span class="a-badge ${currentAdmin.role === "owner" ? "a-badge-lord" : "a-badge-neutral"}">Signed in as ${escapeHtml(currentAdmin.name)}${currentAdmin.role === "owner" ? " (Owner)" : ""}</span>`
          : ""
      }
    </div>
  `;
}

function renderGate(errorMessage) {
  document.getElementById("adminRoot").innerHTML = `
    ${adminHeaderHtml()}
    <div class="admin-gate">
      <div class="admin-gate-icon">${LOCK_ICON}</div>
      <h2>Admin access required</h2>
      <p>Enter the admin secret to view house locks and submitted applications.</p>
      <div class="admin-gate-row">
        <input type="password" id="adminSecretInput" class="admin-search" placeholder="Admin secret" autocomplete="off" />
        <button class="a-btn a-btn-primary" id="adminUnlockBtn">Unlock</button>
      </div>
      ${errorMessage ? `<p class="admin-gate-error">${escapeHtml(errorMessage)}</p>` : ""}
    </div>
  `;
  const input = document.getElementById("adminSecretInput");
  const tryUnlock = () => attemptUnlock(input.value);
  document.getElementById("adminUnlockBtn").onclick = tryUnlock;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") tryUnlock();
  });
  input.focus();
}

async function loadDashboard(secret) {
  const [houses, applications, discordUsers, admin, closed, closedDetails] = await Promise.all([
    Api.adminGetHouses(secret),
    Api.getApplications(secret),
    Api.searchDiscordUsers("", secret),
    Api.whoami(secret),
    Api.getClosedDepartments(),
    Api.getClosedDepartmentsDetailed(secret)
  ]);
  adminSecret = secret;
  allHouses = houses;
  allApplications = applications;
  allDiscordUsers = discordUsers;
  currentAdmin = admin;
  closedDepartments = closed;
  closedDepartmentDetails = closedDetails;
  allStaff = admin.role === "owner" ? await Api.getStaff(secret) : [];
  renderDashboard();
}

async function attemptUnlock(secret) {
  if (!secret) return;
  try {
    await loadDashboard(secret);
  } catch (e) {
    renderGate(e.message);
  }
}

// If they're signed in with Discord and happen to be one of the accounts
// listed server-side in OWNER_DISCORD_USER_IDS, apiFetch already attaches
// their Discord token to every request (see js/api.js) — so this succeeds
// silently with no secret at all. Anyone else just falls through to the
// normal gate below.
async function trySilentDiscordOwnerLogin() {
  if (typeof getDiscordUser !== "function" || !getDiscordUser()) return false;
  try {
    await loadDashboard("");
    return true;
  } catch (e) {
    return false;
  }
}

async function refreshHouses() {
  allHouses = await Api.adminGetHouses(adminSecret);
  renderHouseTable();
  renderStats();
  updateTabCounts();
}

async function refreshApplications() {
  allApplications = await Api.getApplications(adminSecret);
  renderTickets();
  renderStats();
  updateTabCounts();
}

function lordSummary(h) {
  if (h.lordDiscordUserId) return leaderTitle(h);
  if (h.lordRoleId) return `${leaderTitle(h)} (Role + Roblox, legacy)`;
  return null;
}

function houseTableRowHtml(h) {
  const lord = lordSummary(h);
  return `
    <tr data-slug="${h.slug}">
      <td>
        <div class="admin-table-name">${escapeHtml(h.name)}</div>
        <div class="admin-table-faction">${escapeHtml(h.faction)}</div>
      </td>
      <td>
        <span class="a-badge ${h.locked ? "a-badge-locked" : "a-badge-unlocked"}"><span class="dot"></span>${h.locked ? "Locked" : "Unlocked"}</span>
      </td>
      <td>
        <span class="a-badge a-badge-neutral">${h.hasPassword ? "Set" : "None"}</span>
      </td>
      <td>
        ${lord ? `<span class="a-badge a-badge-lord">${lord}</span>` : `<span class="a-badge a-badge-neutral">None</span>`}
      </td>
      <td>${h.memberCount}</td>
      <td>
        <div class="admin-table-actions">
          ${
            currentAdmin && currentAdmin.role === "owner"
              ? `<button class="a-row-btn" data-action="reset-password" data-slug="${h.slug}" title="Reset password">${KEY_ICON}<span>Reset password</span></button>
                 ${h.locked ? `<button class="a-row-btn" data-action="clear-lock" data-slug="${h.slug}" title="Clear lock">${UNLOCK_ICON}<span>Clear lock</span></button>` : ""}
                 <button class="a-row-btn" data-action="set-lord-discord" data-slug="${h.slug}" title="${h.lordDiscordUserId ? "Change" : "Set"} ${leaderTitle(h)}">${CROWN_ICON}<span>${h.lordDiscordUserId ? "Change" : "Set"} ${leaderTitle(h)}</span></button>
                 ${h.lordDiscordUserId ? `<button class="a-row-btn a-row-btn-danger" data-action="clear-lord-discord" data-slug="${h.slug}" title="Remove ${leaderTitle(h)}">${TRASH_ICON}<span>Remove ${leaderTitle(h)}</span></button>` : ""}
                 ${h.lordRoleId ? `<button class="a-row-btn a-row-btn-danger" data-action="clear-lord-role" data-slug="${h.slug}" title="Remove ${leaderTitle(h)} (Role)">${TRASH_ICON}<span>Remove ${leaderTitle(h)} (Role)</span></button>` : ""}
                 <button class="a-row-btn a-row-btn-danger" data-action="delete-house" data-slug="${h.slug}" title="Delete">${TRASH_ICON}<span>Delete</span></button>`
              : ""
          }
        </div>
      </td>
    </tr>
  `;
}

// Click a sortable <th> to sort by it; click again to reverse. Only the
// <tbody> re-renders per keystroke/sort — the header row is static markup
// from renderDashboard(), so its click handlers are bound once, separately
// (see the "Sortable table headers" wiring below).
let houseSort = { key: null, dir: 1 };

function sortHouses(list) {
  if (!houseSort.key) return list;
  const { key, dir } = houseSort;
  return [...list].sort((a, b) => {
    let av, bv;
    if (key === "name") {
      av = a.name.toLowerCase();
      bv = b.name.toLowerCase();
    } else if (key === "locked") {
      av = a.locked ? 1 : 0;
      bv = b.locked ? 1 : 0;
    } else {
      av = a.memberCount;
      bv = b.memberCount;
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return a.name.localeCompare(b.name);
  });
}

function updateSortHeaders() {
  document.querySelectorAll(".admin-th-sort").forEach((th) => {
    const active = th.dataset.sort === houseSort.key;
    th.classList.toggle("active", active);
    th.dataset.dir = active ? (houseSort.dir === 1 ? "asc" : "desc") : "";
  });
}

function renderHouseTable() {
  const query = (document.getElementById("houseSearchInput")?.value || "").trim().toLowerCase();
  const filtered = query ? allHouses.filter((h) => h.name.toLowerCase().includes(query) || h.faction.toLowerCase().includes(query)) : allHouses;
  const sorted = sortHouses(filtered);

  document.getElementById("adminHousesTableBody").innerHTML = sorted.length
    ? sorted.map(houseTableRowHtml).join("")
    : `<tr class="admin-empty-row"><td colspan="6">No houses match "${escapeHtml(query)}".</td></tr>`;

  bindHouseActions();
  updateSortHeaders();
}

function bindHouseActions() {
  document.querySelectorAll('[data-action="reset-password"]').forEach((btn) => {
    btn.onclick = async () => {
      const slug = btn.dataset.slug;
      const label = entityLabel(allHouses.find((x) => x.slug === slug) || { slug, name: slug });
      const password = await Dialog.prompt({
        kicker: "Admin only",
        title: `Reset ${label}'s password`,
        message: "This immediately replaces the current password, whatever it was. Anyone who knew the old one loses access.",
        label: "New password",
        type: "password",
        placeholder: "••••••••",
        confirmText: "Reset password",
        icon: "lock"
      });
      if (!password) return;
      try {
        await Api.adminResetHousePassword(slug, password, adminSecret);
        await refreshHouses();
        await Dialog.alert({ kicker: "Admin only", title: "Password reset", message: `${label}'s password has been changed.` });
      } catch (e) {
        await Dialog.alert({ title: "Couldn't reset", message: e.message, icon: "warning", cardColor: "var(--red)" });
      }
    };
  });

  document.querySelectorAll('[data-action="clear-lock"]').forEach((btn) => {
    btn.onclick = async () => {
      const slug = btn.dataset.slug;
      const label = entityLabel(allHouses.find((x) => x.slug === slug) || { slug, name: slug });
      const ok = await Dialog.confirm({
        kicker: "Admin only",
        title: `Clear ${label}'s lock?`,
        message: "This removes its password entirely; anyone can then lock it again with a new one.",
        confirmText: "Clear lock",
        danger: true
      });
      if (!ok) return;
      await Api.forgotPassword(slug, adminSecret);
      await refreshHouses();
    };
  });

  document.querySelectorAll('[data-action="delete-house"]').forEach((btn) => {
    btn.onclick = async () => {
      const slug = btn.dataset.slug;
      const label = entityLabel(allHouses.find((x) => x.slug === slug) || { slug, name: slug });
      const ok = await Dialog.confirm({
        kicker: "Admin only",
        title: `Delete ${label}?`,
        message: "This permanently removes the house and every member in its family tree. This cannot be undone.",
        confirmText: "Delete permanently",
        danger: true
      });
      if (!ok) return;
      await Api.adminDeleteHouse(slug, adminSecret);
      await refreshHouses();
    };
  });

  document.querySelectorAll('[data-action="set-lord-discord"]').forEach((btn) => {
    btn.onclick = async () => {
      const slug = btn.dataset.slug;
      const h = allHouses.find((x) => x.slug === slug) || { slug, name: slug };
      const title = leaderTitle(h);
      const label = entityLabel(h);
      const noun = h.faction === "CROWN" ? "order" : "house";
      const user = await Dialog.search({
        kicker: label,
        title: `Assign ${title} by Discord account`,
        message: `Only accounts that have signed in with Discord on the site before show up here. Whoever you pick gets password-free access to manage the ${noun}.`,
        fetchResults: (query) => Api.searchDiscordUsers(query, adminSecret)
      });
      if (!user) return;

      try {
        await Api.setLordDiscordId(slug, user.id, adminSecret);
        await refreshHouses();
        await Dialog.alert({
          kicker: label,
          title: `${title} assigned`,
          message: `Only ${user.username} can manage ${label} without the password.`,
          icon: "discord"
        });
      } catch (e) {
        await Dialog.alert({ title: "Couldn't save", message: e.message, icon: "warning", cardColor: "var(--red)" });
      }
    };
  });

  document.querySelectorAll('[data-action="clear-lord-discord"]').forEach((btn) => {
    btn.onclick = async () => {
      const slug = btn.dataset.slug;
      const h = allHouses.find((x) => x.slug === slug) || { slug, name: slug };
      const title = leaderTitle(h);
      const label = entityLabel(h);
      const ok = await Dialog.confirm({
        kicker: label,
        title: `Remove ${label}'s ${title}?`,
        message: "They'll lose password-free access. This doesn't touch the house's password.",
        confirmText: `Remove ${title}`,
        danger: true
      });
      if (!ok) return;

      try {
        await Api.setLordDiscordId(slug, "", adminSecret);
        await refreshHouses();
      } catch (e) {
        await Dialog.alert({ title: "Couldn't remove", message: e.message, icon: "warning", cardColor: "var(--red)" });
      }
    };
  });

  // Discord role + Roblox account assignment predates the search-based
  // picker above and is no longer set-able from the UI — searching who's
  // already signed in is simpler and needs no bot/guild setup. This just
  // gives an escape hatch to clear one a house still has from before,
  // without reintroducing manual role-ID/Roblox-username entry.
  document.querySelectorAll('[data-action="clear-lord-role"]').forEach((btn) => {
    btn.onclick = async () => {
      const slug = btn.dataset.slug;
      const h = allHouses.find((x) => x.slug === slug) || { slug, name: slug };
      const title = leaderTitle(h);
      const label = entityLabel(h);
      const ok = await Dialog.confirm({
        kicker: label,
        title: `Remove ${label}'s ${title} (Role)?`,
        message: "This clears the Discord role + Roblox account assignment. This doesn't touch the house's password.",
        confirmText: `Remove ${title}`,
        danger: true
      });
      if (!ok) return;

      try {
        await Api.setLordRole(slug, "", "", adminSecret);
        await refreshHouses();
      } catch (e) {
        await Dialog.alert({ title: "Couldn't remove", message: e.message, icon: "warning", cardColor: "var(--red)" });
      }
    };
  });
}

function ticketMessageHtml(m) {
  const when = new Date(m.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  return `
    <div class="ticket-message">
      ${escapeHtml(m.body)}
      <span class="ticket-message-date">You · ${when}</span>
    </div>
  `;
}

function ticketAnswersHtml(dept, answers) {
  const entries = dept
    ? dept.questions.map((q) => [q.label, answers[q.id], q.type === "textarea"])
    : Object.entries(answers).map(([k, v]) => [k, v, String(v || "").length > 60]);

  return entries
    .map(
      ([label, value, isLong]) => `
      <div class="ticket-answer-card${isLong ? " ticket-answer-full" : ""}">
        <div class="ticket-answer-label">${escapeHtml(label)}</div>
        <div class="ticket-answer-value">${escapeHtml(value) || "<em>N/A</em>"}</div>
      </div>`
    )
    .join("");
}

function ticketHtml(app) {
  const dept = DEPARTMENTS.find((d) => d.key === app.department);
  const color = "var(--a-accent)";
  let answers = app.answers || {};
  if (typeof answers === "string") {
    try {
      answers = JSON.parse(answers);
    } catch (e) {
      answers = {};
    }
  }

  const submitted = app.created_at
    ? new Date(app.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : "";

  return `
    <details class="ticket-card" data-id="${app.id}">
      <summary class="ticket-summary">
        <div class="ticket-icon" style="--card-color:${color}">${dept ? DEPT_ICONS[dept.icon] || "" : ""}</div>
        <div class="ticket-summary-main">
          <div class="ticket-dept-name" style="color:${color}">${escapeHtml(dept ? dept.name : app.department)}</div>
          <div class="ticket-applicant">
            ${escapeHtml(app.roblox_username)}${copyBtnHtml(app.roblox_username, "Roblox username")}
            <span class="ticket-applicant-sub">Discord: ${escapeHtml(app.discord_username)}${copyBtnHtml(app.discord_username, "Discord username")}</span>
          </div>
        </div>
        <div class="ticket-summary-meta">
          ${app.status === "approved" ? `<span class="a-badge a-badge-approved">Approved</span>` : ""}
          ${app.status === "declined" ? `<span class="a-badge a-badge-declined">Declined</span>` : ""}
          <span class="ticket-date">${submitted}</span>
          <span class="chev">${CHEVRON_ICON}</span>
        </div>
      </summary>
      <div class="ticket-body">
        ${app.availability ? `<span class="ticket-avail-pill">${DEPT_ICONS.clock} ${escapeHtml(app.availability)}</span>` : ""}
        <div class="ticket-answers">${ticketAnswersHtml(dept, answers)}</div>
        <blockquote class="ticket-why" style="--card-color:${color}">
          <span class="ticket-why-label">Why they want to join</span>
          ${escapeHtml(app.why)}
        </blockquote>
        ${
          app.status === "declined"
            ? `<blockquote class="ticket-why" style="--card-color:var(--a-accent)">
                 <span class="ticket-why-label">Decline reason</span>
                 ${escapeHtml(app.decline_reason)}
               </blockquote>`
            : ""
        }
        ${
          app.image_path
            ? `<a class="ticket-image-link" href="${app.image_path}" target="_blank" rel="noopener">
                 <img class="ticket-image" src="${app.image_path}" alt="Attached image" />
               </a>`
            : ""
        }
        <div class="modal-actions" style="justify-content:flex-start; margin-top:6px">
          ${
            app.status === "approved"
              ? `<button class="a-btn" disabled>Approved ✓</button>`
              : app.status === "declined"
                ? `<button class="a-btn" disabled>Declined</button>`
                : `
                  <button class="a-btn a-btn-success" data-action="approve-ticket" data-id="${app.id}">Approve</button>
                  <button class="a-btn a-btn-danger" data-action="decline-ticket" data-id="${app.id}">Decline</button>
                `
          }
          <button class="a-btn a-btn-danger" data-action="dismiss-ticket" data-id="${app.id}">Dismiss ticket</button>
        </div>

        <div class="ticket-thread">
          <span class="ticket-why-label">Messages</span>
          <div class="ticket-message-list" id="ticketMessages-${app.id}">${(app.messages || []).map(ticketMessageHtml).join("")}</div>
          <div class="ticket-reply">
            <textarea class="ticket-reply-input" id="ticketReply-${app.id}" placeholder="Write your reply here."></textarea>
            <div class="ticket-reply-actions">
              <button class="a-btn a-btn-primary" data-action="send-ticket-message" data-id="${app.id}">Send reply</button>
            </div>
          </div>
        </div>
      </div>
    </details>
  `;
}

// Shared by the on-screen ticket list and the CSV export below, so
// "export" always means exactly what's currently visible/filtered.
function filteredApplications() {
  const query = (document.getElementById("appSearchInput")?.value || "").trim().toLowerCase();
  const deptFilter = document.getElementById("appDeptFilter")?.value || "";
  const statusFilter = document.getElementById("appStatusFilter")?.value || "";

  return allApplications.filter((app) => {
    const matchesQuery = !query || app.roblox_username.toLowerCase().includes(query) || app.discord_username.toLowerCase().includes(query);
    const matchesDept = !deptFilter || app.department === deptFilter;
    const matchesStatus = !statusFilter || (app.status || "pending") === statusFilter;
    return matchesQuery && matchesDept && matchesStatus;
  });
}

function renderTickets() {
  const query = (document.getElementById("appSearchInput")?.value || "").trim().toLowerCase();
  const filtered = filteredApplications();

  const el = document.getElementById("adminTicketsList");
  el.innerHTML = filtered.length ? filtered.map(ticketHtml).join("") : `<p class="empty-state">No applications match.</p>`;

  el.querySelectorAll('[data-action="approve-ticket"]').forEach((btn) => {
    btn.onclick = async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const { dmSent } = await Api.approveApplication(id, adminSecret);
      await refreshApplications();
      await Dialog.alert({
        title: "Application approved",
        message: dmSent
          ? "They've been DMed on Discord to let them know."
          : "Saved. They weren't signed in with Discord when they applied, so no DM could be sent. The staff webhook still got it.",
        icon: dmSent ? "discord" : "info"
      });
    };
  });

  el.querySelectorAll('[data-action="decline-ticket"]').forEach((btn) => {
    btn.onclick = async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const reason = await Dialog.prompt({
        kicker: "Admin only",
        title: "Decline this application?",
        label: "Reason",
        placeholder: "Let them know why, so they can improve next time...",
        multiline: true,
        required: true,
        confirmText: "Decline",
        icon: "warning",
        cardColor: "var(--red)"
      });
      if (!reason) return;
      const { dmSent } = await Api.declineApplication(id, reason, adminSecret);
      await refreshApplications();
      await Dialog.alert({
        title: "Application declined",
        message: dmSent
          ? "They've been DMed the reason on Discord."
          : "Reason saved. They weren't signed in with Discord when they applied, so no DM could be sent. They'll still see it if they sign in on the site.",
        icon: dmSent ? "discord" : "info"
      });
    };
  });

  el.querySelectorAll('[data-action="send-ticket-message"]').forEach((btn) => {
    btn.onclick = async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const textarea = document.getElementById(`ticketReply-${id}`);
      const body = textarea.value.trim();
      if (!body) return;

      btn.disabled = true;
      try {
        const { message } = await Api.messageApplicant(id, body, adminSecret);
        // Append in place instead of a full refreshApplications() re-render
        // — that would collapse this <details> back closed, losing the
        // thread the admin's mid-conversation with.
        const app = allApplications.find((a) => String(a.id) === String(id));
        if (app) {
          app.messages = app.messages || [];
          app.messages.push(message);
        }
        document.getElementById(`ticketMessages-${id}`).insertAdjacentHTML("beforeend", ticketMessageHtml(message));
        textarea.value = "";
      } catch (err) {
        await Dialog.alert({ title: "Couldn't send", message: err.message, icon: "warning", cardColor: "var(--red)" });
      } finally {
        btn.disabled = false;
      }
    };
  });

  el.querySelectorAll('[data-action="dismiss-ticket"]').forEach((btn) => {
    btn.onclick = async (e) => {
      e.preventDefault();
      const id = btn.dataset.id;
      const ok = await Dialog.confirm({
        kicker: "Admin only",
        title: "Dismiss this ticket?",
        message: "This permanently removes the application from the list.",
        confirmText: "Dismiss",
        danger: true
      });
      if (!ok) return;
      await Api.deleteApplication(id, adminSecret);
      await refreshApplications();
    };
  });
}

// Builds a CSV from a header + array-of-arrays and triggers a browser
// download — shared by every "Export CSV" button on the dashboard so they
// all produce the same quoting/escaping and file-naming convention.
function downloadCsv(filename, header, rows) {
  const csvField = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [header, ...rows].map((row) => row.map(csvField).join(",")).join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Exports exactly what the toolbar's search/status/department filters
// currently show — "export" means the same list the admin is looking at.
function exportApplicationsCsv() {
  const rows = filteredApplications();
  if (!rows.length) {
    Dialog.alert({ title: "Nothing to export", message: "No applications match the current filters." });
    return;
  }

  const header = ["ID", "Department", "Roblox username", "Discord username", "Status", "Availability", "Why they want to join", "Submitted"];
  const lines = rows.map((app) => {
    const dept = DEPARTMENTS.find((d) => d.key === app.department);
    return [
      app.id,
      dept ? dept.name : app.department,
      app.roblox_username,
      app.discord_username,
      app.status || "pending",
      app.availability || "",
      app.why || "",
      app.created_at ? new Date(app.created_at).toISOString() : ""
    ];
  });
  downloadCsv(`applications-${new Date().toISOString().slice(0, 10)}.csv`, header, lines);
}

function exportHousesCsv() {
  if (!allHouses.length) {
    Dialog.alert({ title: "Nothing to export", message: "There are no houses yet." });
    return;
  }
  const header = ["Slug", "Name", "Faction", "Locked", "Password set", "Leader (Discord ID)", "Members"];
  const lines = allHouses.map((h) => [
    h.slug,
    h.name,
    h.faction,
    h.locked ? "Yes" : "No",
    h.hasPassword ? "Yes" : "No",
    h.lordDiscordUserId || "",
    h.memberCount
  ]);
  downloadCsv(`houses-${new Date().toISOString().slice(0, 10)}.csv`, header, lines);
}

// Shared by the header's stat row and the Maintenance tab's overview row —
// same clickable card, jumps straight to the tab it's counting.
function statCardHtml(value, label, modifier, tab) {
  return `
    <button type="button" class="admin-stat${modifier ? ` admin-stat-${modifier}` : ""}" onclick="switchTab('${tab}')">
      <div class="admin-stat-value">${value}</div><div class="admin-stat-label">${label}</div>
    </button>
  `;
}

function renderStats() {
  const locked = allHouses.filter((h) => h.locked).length;
  const totalMembers = allHouses.reduce((sum, h) => sum + h.memberCount, 0);
  document.getElementById("adminStats").innerHTML =
    statCardHtml(allHouses.length, "Houses", "accent", "houses") +
    statCardHtml(locked, "Locked", "danger", "houses") +
    statCardHtml(allHouses.length - locked, "Unlocked", "success", "houses") +
    statCardHtml(totalMembers, "Family tree members", "", "houses") +
    statCardHtml(allApplications.length, "Applications", "accent", "applications");
}

function renderMaintenanceStats() {
  const el = document.getElementById("adminMaintenanceStats");
  if (!el) return;
  const pending = allApplications.filter((a) => (a.status || "pending") === "pending").length;
  el.innerHTML =
    statCardHtml(DEPARTMENTS.length, "Departments", "", "applications") +
    statCardHtml(closedDepartments.length, "Departments closed", closedDepartments.length ? "danger" : "success", "applications") +
    statCardHtml(pending, "Pending applications", pending ? "accent" : "", "applications") +
    statCardHtml(allStaff.length, "Staff accounts", "", "staff") +
    statCardHtml(allDiscordUsers.length, "Discord sign-ins", "", "signins");
}

function updateTabCounts() {
  document.getElementById("housesTabCount").textContent = allHouses.length;
  document.getElementById("appsTabCount").textContent = allApplications.length;
  document.getElementById("signinsTabCount").textContent = allDiscordUsers.length;
  const staffCount = document.getElementById("staffTabCount");
  if (staffCount) staffCount.textContent = allStaff.length;
  renderMaintenanceStats();
}

// Formats a timestamp as a short relative label ("3h ago") with the exact
// date/time in a tooltip — used for both the sign-ins log and staff list so
// neither needs to show a long absolute timestamp inline.
function relativeTime(dateInput) {
  if (!dateInput) return { text: "—", title: "" };
  const date = new Date(dateInput);
  const title = date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return { text: "Just now", title };
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return { text: `${minutes}m ago`, title };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { text: `${hours}h ago`, title };
  const days = Math.round(hours / 24);
  if (days < 30) return { text: `${days}d ago`, title };
  return { text: date.toLocaleDateString(undefined, { dateStyle: "medium" }), title };
}

function staffRowHtml(s) {
  const avatarUrl = typeof discordAvatarUrl === "function" ? discordAvatarUrl({ id: s.discordUserId, avatar: s.avatar }) : "";
  const added = relativeTime(s.createdAt);
  return `
    <tr data-id="${s.id}">
      <td>
        <div class="admin-table-user">
          <img class="admin-table-avatar admin-table-avatar-lg" src="${avatarUrl}" alt="" />
          <span class="admin-table-name">${escapeHtml(s.name)}</span>
        </div>
      </td>
      <td><span class="admin-table-time" title="${escapeHtml(added.title)}">${escapeHtml(added.text)}</span></td>
      <td><button class="a-link a-link-danger" data-action="delete-staff" data-id="${s.id}">Revoke</button></td>
    </tr>
  `;
}

function renderStaffList() {
  const el = document.getElementById("adminStaffList");
  if (!el) return;
  el.innerHTML = allStaff.length
    ? `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Name</th><th>Added</th><th></th></tr></thead>
          <tbody>${allStaff.map(staffRowHtml).join("")}</tbody>
        </table>
      </div>`
    : `<p class="empty-state">No staff accounts yet.</p>`;

  el.querySelectorAll('[data-action="delete-staff"]').forEach((btn) => {
    btn.onclick = async () => {
      const staff = allStaff.find((s) => s.id === btn.dataset.id);
      const ok = await Dialog.confirm({
        kicker: "Admin only",
        title: `Revoke ${staff ? staff.name : "this account"}'s access?`,
        message: "They'll immediately lose access to the admin dashboard.",
        confirmText: "Revoke access",
        danger: true
      });
      if (!ok) return;
      await Api.deleteStaff(btn.dataset.id, adminSecret);
      await refreshStaff();
    };
  });
}

async function refreshStaff() {
  allStaff = await Api.getStaff(adminSecret);
  renderStaffList();
  updateTabCounts();
}

function discordUserRowHtml(u) {
  const avatarUrl = typeof discordAvatarUrl === "function" ? discordAvatarUrl(u) : "";
  const seen = relativeTime(u.lastSeenAt);
  return `
    <tr>
      <td>
        <div class="admin-table-user">
          <img class="admin-table-avatar admin-table-avatar-lg" src="${avatarUrl}" alt="" />
          <span class="admin-table-name">${escapeHtml(u.username)}</span>
        </div>
      </td>
      <td class="admin-mono">${escapeHtml(u.id)}</td>
      <td><span class="admin-table-time" title="${escapeHtml(seen.title)}">${seen.text}</span></td>
    </tr>
  `;
}

// Limited to the 100 most recently seen accounts server-side; the search box
// below filters within that set rather than re-querying, same as Houses/Staff.
function renderDiscordUsersList() {
  const query = (document.getElementById("discordUserSearchInput")?.value || "").trim().toLowerCase();
  const filtered = query ? allDiscordUsers.filter((u) => u.username.toLowerCase().includes(query)) : allDiscordUsers;

  document.getElementById("adminDiscordUsersList").innerHTML = filtered.length
    ? `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Discord account</th><th>ID</th><th>Last seen</th></tr></thead>
          <tbody>${filtered.map(discordUserRowHtml).join("")}</tbody>
        </table>
      </div>`
    : `<p class="empty-state">${allDiscordUsers.length ? `No accounts match "${escapeHtml(query)}".` : "Nobody's signed in with Discord yet."}</p>`;
}

function deptLockRowHtml(dept) {
  const closed = closedDepartments.includes(dept.key);
  const detail = closed ? closedDepartmentDetails.find((d) => d.department === dept.key) : null;
  const closedSince = detail ? relativeTime(detail.closedAt) : null;
  return `
    <div class="admin-dept-lock-row" data-key="${dept.key}">
      <div class="admin-dept-lock-info">
        <span class="admin-dept-lock-name">${escapeHtml(dept.name)}</span>
        <span class="a-badge ${closed ? "a-badge-locked" : "a-badge-unlocked"}"><span class="dot"></span>${closed ? "Closed" : "Open"}</span>
        ${closedSince ? `<span class="admin-table-time" title="${escapeHtml(closedSince.title)}">since ${closedSince.text}</span>` : ""}
      </div>
      <button class="a-btn ${closed ? "a-btn-primary" : "a-btn-danger"}" data-action="toggle-dept-lock" data-key="${dept.key}">
        ${closed ? "Reopen" : "Close"}
      </button>
    </div>
  `;
}

function renderDeptLocks() {
  const el = document.getElementById("adminDeptLocks");
  if (!el) return;
  el.innerHTML = DEPARTMENTS.map(deptLockRowHtml).join("");

  el.querySelectorAll('[data-action="toggle-dept-lock"]').forEach((btn) => {
    btn.onclick = async () => {
      const key = btn.dataset.key;
      const dept = DEPARTMENTS.find((d) => d.key === key);
      const closed = closedDepartments.includes(key);
      if (!closed) {
        const ok = await Dialog.confirm({
          kicker: "Admin only",
          title: `Close ${dept ? dept.name : "this department"} to applications?`,
          message: "Members won't be able to open or submit an application to it until you reopen it.",
          confirmText: "Close department",
          danger: true
        });
        if (!ok) return;
      }
      btn.disabled = true;
      try {
        if (closed) {
          await Api.openDepartment(key, adminSecret);
        } else {
          await Api.closeDepartment(key, adminSecret);
        }
        await refreshDeptLocks();
      } finally {
        btn.disabled = false;
      }
    };
  });
}

async function refreshDeptLocks() {
  [closedDepartments, closedDepartmentDetails] = await Promise.all([
    Api.getClosedDepartments(),
    Api.getClosedDepartmentsDetailed(adminSecret)
  ]);
  renderDeptLocks();
  renderMaintenanceStats();
}

function switchTab(name) {
  document.querySelectorAll(".admin-tab").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === name));
  document.querySelectorAll(".admin-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === name));
}

function renderDashboard() {
  const isOwner = currentAdmin && currentAdmin.role === "owner";
  const deptOptions = DEPARTMENTS.map((d) => `<option value="${d.key}">${escapeHtml(d.name)}</option>`).join("");

  document.getElementById("adminRoot").innerHTML = `
    ${adminHeaderHtml()}
    <div class="admin-stats" id="adminStats"></div>

    <div class="admin-tabs">
      <button class="admin-tab active" data-tab="houses">${HOUSE_TAB_ICON}Houses <span class="count" id="housesTabCount">0</span></button>
      <button class="admin-tab" data-tab="applications">${CLIPBOARD_ICON}Applications <span class="count" id="appsTabCount">0</span></button>
      <button class="admin-tab" data-tab="signins">${DISCORD_TAB_ICON}Discord Sign-Ins <span class="count" id="signinsTabCount">0</span></button>
      ${isOwner ? `<button class="admin-tab" data-tab="staff">${STAFF_TAB_ICON}Staff <span class="count" id="staffTabCount">0</span></button>` : ""}
      ${isOwner ? `<button class="admin-tab" data-tab="maintenance">${WRENCH_ICON}Maintenance</button>` : ""}
    </div>

    <div class="admin-panel active" data-panel="houses">
      <div class="admin-toolbar">
        <input type="text" id="houseSearchInput" class="admin-search" placeholder="Search houses by name or faction..." />
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th class="admin-th-sort" data-sort="name">House</th>
              <th class="admin-th-sort" data-sort="locked">Status</th>
              <th>Password</th>
              <th>Leader</th>
              <th class="admin-th-sort" data-sort="members">Members</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="adminHousesTableBody"></tbody>
        </table>
      </div>
    </div>

    <div class="admin-panel" data-panel="applications">
      <p class="admin-section-desc">Close a department to stop new applications — members won't be able to open or submit one until you reopen it. Existing applications aren't affected.</p>
      <div class="admin-dept-locks" id="adminDeptLocks"></div>
      <div class="admin-toolbar">
        <input type="text" id="appSearchInput" class="admin-search" placeholder="Search by Roblox or Discord username..." />
        <select id="appStatusFilter" class="admin-filter-select">
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="declined">Declined</option>
        </select>
        <select id="appDeptFilter" class="admin-filter-select">
          <option value="">All departments</option>
          ${deptOptions}
        </select>
        <button class="a-row-btn" id="exportApplicationsBtn" title="Export the filtered list as CSV">${DOWNLOAD_ICON}<span>Export CSV</span></button>
      </div>
      <div id="adminTicketsList"></div>
    </div>

    <div class="admin-panel" data-panel="signins">
      <p class="admin-section-desc">Everyone who's signed in with Discord, most recent first.</p>
      <div class="admin-toolbar">
        <input type="text" id="discordUserSearchInput" class="admin-search" placeholder="Search by Discord username..." />
      </div>
      <div id="adminDiscordUsersList"></div>
    </div>

    ${
      isOwner
        ? `
    <div class="admin-panel" data-panel="staff">
      <p class="admin-section-desc">Staff can manage houses and applications. Only you can delete houses, manage staff, or reset data.</p>
      <div class="admin-toolbar">
        <button class="a-btn a-btn-primary" id="addStaffBtn">+ Add staff by Discord</button>
      </div>
      <div id="adminStaffList"></div>
    </div>`
        : ""
    }

    ${
      isOwner
        ? `
    <div class="admin-panel" data-panel="maintenance">
      <p class="admin-section-desc">Site-wide housekeeping and data tools. Safe actions never remove or overwrite existing data; the danger zone can't be undone.</p>
      <div class="admin-stats" id="adminMaintenanceStats"></div>

      <div class="admin-action-group">
        <h3>Safe actions</h3>
        <div class="admin-action-cards">
          <div class="admin-action-card">
            <div class="admin-action-card-icon">${PLUS_ICON}</div>
            <h4>Add any new houses</h4>
            <p>Adds houses from the seed list that don't exist here yet. Never touches an existing house or its members.</p>
            <button class="a-btn" id="adminSeedMissingBtn">Add new houses</button>
          </div>
          <div class="admin-action-card">
            <div class="admin-action-card-icon">${DOWNLOAD_ICON}</div>
            <h4>Export houses as CSV</h4>
            <p>Downloads every house's lock status, password state, leader, and member count.</p>
            <button class="a-btn" id="adminExportHousesBtn">Export CSV</button>
          </div>
        </div>
      </div>

      <div class="admin-action-group">
        <h3>Danger zone</h3>
        <div class="admin-action-cards">
          <div class="admin-action-card danger">
            <div class="admin-action-card-icon">${WARNING_ICON}</div>
            <h4>Reset all house data</h4>
            <p>Resets every house's lore, locks, and members back to default, for every visitor. This cannot be undone.</p>
            <button class="a-btn a-btn-danger" id="adminResetAllBtn">Reset everything</button>
          </div>
        </div>
      </div>
    </div>`
        : ""
    }
  `;

  document.querySelectorAll(".admin-tab").forEach((btn) => {
    btn.onclick = () => switchTab(btn.dataset.tab);
  });

  document.getElementById("houseSearchInput").addEventListener("input", renderHouseTable);
  document.querySelectorAll(".admin-th-sort").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      houseSort = { key, dir: houseSort.key === key ? houseSort.dir * -1 : 1 };
      renderHouseTable();
    });
  });
  document.getElementById("appSearchInput").addEventListener("input", renderTickets);
  document.getElementById("appDeptFilter").addEventListener("change", renderTickets);
  document.getElementById("exportApplicationsBtn").addEventListener("click", exportApplicationsCsv);
  document.getElementById("appStatusFilter").addEventListener("change", renderTickets);
  document.getElementById("discordUserSearchInput").addEventListener("input", renderDiscordUsersList);

  // Delegated on the list itself (stable across renderTickets() re-renders)
  // rather than per-row — the copy buttons live inside a <summary>, so this
  // also has to stop the click from toggling the ticket open/closed.
  document.getElementById("adminTicketsList").addEventListener("click", async (e) => {
    const btn = e.target.closest(".ticket-copy-btn");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
    } catch (err) {
      return;
    }
    const original = btn.innerHTML;
    btn.innerHTML = CHECK_ICON;
    btn.classList.add("copied");
    setTimeout(() => {
      btn.innerHTML = original;
      btn.classList.remove("copied");
    }, 1200);
  });

  if (isOwner) {
    document.getElementById("adminSeedMissingBtn").onclick = async () => {
      const { added } = await Api.seedMissingHouses(adminSecret);
      await refreshHouses();
      await Dialog.alert({
        title: added.length ? "Houses added" : "Nothing to add",
        message: added.length ? `Added: ${added.join(", ")}.` : "Every house in the list already exists here."
      });
    };

    document.getElementById("adminResetAllBtn").onclick = async () => {
      const ok = await Dialog.confirm({
        kicker: "Admin only",
        title: "Reset all houses?",
        message: "This resets every house's lore, locks, and members back to default, for every visitor. This cannot be undone.",
        confirmText: "Reset everything",
        danger: true
      });
      if (!ok) return;
      await Api.resetAll(adminSecret);
      await refreshHouses();
      await refreshApplications();
    };

    document.getElementById("adminExportHousesBtn").addEventListener("click", exportHousesCsv);

    document.getElementById("addStaffBtn").onclick = async () => {
      const user = await Dialog.search({
        kicker: "Staff",
        title: "Add staff by Discord account",
        message: "Only accounts that have signed in with Discord on the site before show up here. Whoever you pick can open the admin dashboard right away, no password required.",
        fetchResults: (query) => Api.searchDiscordUsers(query, adminSecret)
      });
      if (!user) return;

      const wantsPassword = await Dialog.confirm({
        kicker: "Staff",
        title: `Also give ${user.username} a password?`,
        message: "Optional — lets them log in with a password too, not just by signing in with that Discord account.",
        confirmText: "Set a password",
        cancelText: "Skip",
        icon: "lock"
      });

      let password;
      if (wantsPassword) {
        password = await Dialog.prompt({
          kicker: "Staff",
          title: `Set a password for ${user.username}`,
          label: "Password",
          type: "password",
          placeholder: "••••••••",
          confirmText: "Add staff",
          icon: "lock",
          required: true
        });
        if (!password) return;
      }

      try {
        await Api.addStaffByDiscord(user.id, adminSecret, password);
        await refreshStaff();
      } catch (e) {
        await Dialog.alert({ title: "Couldn't add staff", message: e.message, icon: "warning", cardColor: "var(--red)" });
      }
    };

    renderStaffList();
  }

  renderStats();
  updateTabCounts();
  renderHouseTable();
  renderDeptLocks();
  renderTickets();
  renderDiscordUsersList();
  renderMaintenanceStats();
}

(async function initAdminPage() {
  document.getElementById("adminRoot").innerHTML = `${adminHeaderHtml()}<p class="page-desc">Checking access...</p>`;
  const loggedInSilently = await trySilentDiscordOwnerLogin();
  if (!loggedInSilently) renderGate();
})();
