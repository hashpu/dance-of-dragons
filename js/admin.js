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

function adminHeaderHtml() {
  return `
    <div class="admin-header">
      <div>
        <div class="admin-kicker">Internal tool</div>
        <h1>Admin dashboard</h1>
        <p>House locks and Lord assignments, submitted applications, and site maintenance. Not linked from the public site.</p>
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

async function attemptUnlock(secret) {
  if (!secret) return;
  try {
    const [houses, applications, admin] = await Promise.all([Api.adminGetHouses(secret), Api.getApplications(secret), Api.whoami(secret)]);
    adminSecret = secret;
    allHouses = houses;
    allApplications = applications;
    currentAdmin = admin;
    allStaff = admin.role === "owner" ? await Api.getStaff(secret) : [];
    renderDashboard();
  } catch (e) {
    renderGate(e.message);
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
  if (h.lordDiscordUserId) return "Discord ID";
  if (h.lordRoleId) return "Role + Roblox";
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
              ? `${h.locked ? `<button class="a-link" data-action="clear-lock" data-slug="${h.slug}">Clear lock</button>` : ""}
                 <button class="a-link" data-action="set-lord-discord" data-slug="${h.slug}">Set Lord (ID)</button>
                 <button class="a-link" data-action="set-lord-role" data-slug="${h.slug}">Set Lord (Role)</button>
                 <button class="a-link a-link-danger" data-action="delete-house" data-slug="${h.slug}">Delete</button>`
              : ""
          }
        </div>
      </td>
    </tr>
  `;
}

function renderHouseTable() {
  const query = (document.getElementById("houseSearchInput")?.value || "").trim().toLowerCase();
  const filtered = query ? allHouses.filter((h) => h.name.toLowerCase().includes(query) || h.faction.toLowerCase().includes(query)) : allHouses;

  document.getElementById("adminHousesTableBody").innerHTML = filtered.length
    ? filtered.map(houseTableRowHtml).join("")
    : `<tr class="admin-empty-row"><td colspan="6">No houses match "${escapeHtml(query)}".</td></tr>`;

  bindHouseActions();
}

function bindHouseActions() {
  document.querySelectorAll('[data-action="clear-lock"]').forEach((btn) => {
    btn.onclick = async () => {
      const slug = btn.dataset.slug;
      const ok = await Dialog.confirm({
        kicker: "Admin only",
        title: `Clear ${slug}'s lock?`,
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
      const ok = await Dialog.confirm({
        kicker: "Admin only",
        title: `Delete House ${slug}?`,
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
      const houseName = (allHouses.find((h) => h.slug === slug) || {}).name || slug;
      const discordUserId = await Dialog.prompt({
        kicker: `House ${houseName}`,
        title: "Assign Lord by Discord ID",
        message: "Whoever signs in with this exact Discord account gets password-free access to manage the house. Leave blank to remove.",
        label: "Discord user ID",
        placeholder: "e.g. 123456789012345678",
        confirmText: "Save",
        icon: "discord"
      });
      if (discordUserId === null) return;

      try {
        await Api.setLordDiscordId(slug, discordUserId.trim(), adminSecret);
        await refreshHouses();
        await Dialog.alert({
          kicker: `House ${houseName}`,
          title: discordUserId.trim() ? "Lord assigned" : "Lord removed",
          message: discordUserId.trim()
            ? `Only the Discord account with ID ${discordUserId.trim()} can manage House ${houseName} without the password.`
            : `House ${houseName} no longer has a Discord-ID Lord assigned.`,
          icon: "discord"
        });
      } catch (e) {
        await Dialog.alert({ title: "Couldn't save", message: e.message, icon: "warning", cardColor: "var(--red)" });
      }
    };
  });

  document.querySelectorAll('[data-action="set-lord-role"]').forEach((btn) => {
    btn.onclick = async () => {
      const slug = btn.dataset.slug;
      const houseName = (allHouses.find((h) => h.slug === slug) || {}).name || slug;
      const roleId = await Dialog.prompt({
        kicker: `House ${houseName}`,
        title: "Assign Lord by Discord role",
        message: "Leave blank to remove the Lord entirely.",
        label: "Discord role ID",
        placeholder: "e.g. 123456789012345678",
        confirmText: "Next",
        icon: "discord"
      });
      if (roleId === null) return;

      let robloxUsername = "";
      if (roleId.trim()) {
        robloxUsername = await Dialog.prompt({
          kicker: `House ${houseName}`,
          title: "Match a Roblox account",
          message: "They must be signed in as BOTH that Discord role and this exact Roblox account for Lord access to work.",
          label: "Roblox username",
          placeholder: "e.g. WinterfellKing",
          confirmText: "Save",
          icon: "lock"
        });
        if (robloxUsername === null) return;
      }

      try {
        await Api.setLordRole(slug, roleId.trim(), robloxUsername.trim(), adminSecret);
        await refreshHouses();
        await Dialog.alert({
          kicker: `House ${houseName}`,
          title: roleId.trim() ? "Lord assigned" : "Lord removed",
          message: roleId.trim()
            ? `Only someone signed in with that Discord role AND that Roblox account can manage House ${houseName} without the password.`
            : `House ${houseName} no longer has a Lord assigned.`,
          icon: "discord"
        });
      } catch (e) {
        await Dialog.alert({ title: "Couldn't save", message: e.message, icon: "warning", cardColor: "var(--red)" });
      }
    };
  });
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
  const color = dept ? dept.color : "var(--a-muted)";
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
          <div class="ticket-applicant">${escapeHtml(app.roblox_username)}<span class="ticket-applicant-sub">Discord: ${escapeHtml(app.discord_username)}</span></div>
        </div>
        <div class="ticket-summary-meta">
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
          app.image_path
            ? `<a class="ticket-image-link" href="${app.image_path}" target="_blank" rel="noopener">
                 <img class="ticket-image" src="${app.image_path}" alt="Attached image" />
               </a>`
            : ""
        }
        <div class="modal-actions" style="justify-content:flex-start; margin-top:6px">
          <button class="a-btn a-btn-danger" data-action="dismiss-ticket" data-id="${app.id}">Dismiss ticket</button>
        </div>
      </div>
    </details>
  `;
}

function renderTickets() {
  const query = (document.getElementById("appSearchInput")?.value || "").trim().toLowerCase();
  const deptFilter = document.getElementById("appDeptFilter")?.value || "";

  const filtered = allApplications.filter((app) => {
    const matchesQuery = !query || app.roblox_username.toLowerCase().includes(query) || app.discord_username.toLowerCase().includes(query);
    const matchesDept = !deptFilter || app.department === deptFilter;
    return matchesQuery && matchesDept;
  });

  const el = document.getElementById("adminTicketsList");
  el.innerHTML = filtered.length ? filtered.map(ticketHtml).join("") : `<p class="empty-state">No applications match.</p>`;

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

function renderStats() {
  const locked = allHouses.filter((h) => h.locked).length;
  const totalMembers = allHouses.reduce((sum, h) => sum + h.memberCount, 0);
  document.getElementById("adminStats").innerHTML = `
    <div class="admin-stat admin-stat-accent"><div class="admin-stat-value">${allHouses.length}</div><div class="admin-stat-label">Houses</div></div>
    <div class="admin-stat admin-stat-danger"><div class="admin-stat-value">${locked}</div><div class="admin-stat-label">Locked</div></div>
    <div class="admin-stat admin-stat-success"><div class="admin-stat-value">${allHouses.length - locked}</div><div class="admin-stat-label">Unlocked</div></div>
    <div class="admin-stat"><div class="admin-stat-value">${totalMembers}</div><div class="admin-stat-label">Family tree members</div></div>
    <div class="admin-stat admin-stat-accent"><div class="admin-stat-value">${allApplications.length}</div><div class="admin-stat-label">Applications</div></div>
  `;
}

function updateTabCounts() {
  document.getElementById("housesTabCount").textContent = allHouses.length;
  document.getElementById("appsTabCount").textContent = allApplications.length;
  const staffCount = document.getElementById("staffTabCount");
  if (staffCount) staffCount.textContent = allStaff.length;
}

function staffRowHtml(s) {
  const created = s.createdAt ? new Date(s.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" }) : "";
  return `
    <tr data-id="${s.id}">
      <td class="admin-table-name">${escapeHtml(s.name)}</td>
      <td>${created}</td>
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
      <button class="admin-tab active" data-tab="houses">Houses <span class="count" id="housesTabCount">0</span></button>
      <button class="admin-tab" data-tab="applications">Applications <span class="count" id="appsTabCount">0</span></button>
      ${isOwner ? `<button class="admin-tab" data-tab="staff">Staff <span class="count" id="staffTabCount">0</span></button>` : ""}
      ${isOwner ? `<button class="admin-tab" data-tab="maintenance">Maintenance</button>` : ""}
    </div>

    <div class="admin-panel active" data-panel="houses">
      <div class="admin-toolbar">
        <input type="text" id="houseSearchInput" class="admin-search" placeholder="Search houses by name or faction..." />
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>House</th><th>Status</th><th>Password</th><th>Lord</th><th>Members</th><th></th></tr>
          </thead>
          <tbody id="adminHousesTableBody"></tbody>
        </table>
      </div>
    </div>

    <div class="admin-panel" data-panel="applications">
      <div class="admin-toolbar">
        <input type="text" id="appSearchInput" class="admin-search" placeholder="Search by Roblox or Discord username..." />
        <select id="appDeptFilter" class="admin-filter-select">
          <option value="">All departments</option>
          ${deptOptions}
        </select>
      </div>
      <div id="adminTicketsList"></div>
    </div>

    ${
      isOwner
        ? `
    <div class="admin-panel" data-panel="staff">
      <p class="admin-section-desc">
        Give someone their own login to this dashboard without sharing the real admin secret. Staff can view
        houses and applications and dismiss tickets, but can't clear locks, delete houses, manage staff, or
        reset data.
      </p>
      <div class="admin-staff-form">
        <input type="text" id="staffNameInput" class="admin-search" placeholder="Name" />
        <input type="text" id="staffPasswordInput" class="admin-search" placeholder="Password (min 4 characters)" />
        <button class="a-btn a-btn-primary" id="addStaffBtn">Add staff</button>
      </div>
      <p class="error-text" id="staffFormError" style="display:none"></p>
      <div id="adminStaffList"></div>
    </div>`
        : ""
    }

    ${
      isOwner
        ? `
    <div class="admin-panel" data-panel="maintenance">
      <div class="admin-danger-zone">
        <h3>Danger zone</h3>
        <p>These affect every visitor's data. Only use them deliberately.</p>
        <div class="admin-danger-actions">
          <button class="a-btn" id="adminSeedMissingBtn">Add any new houses (safe)</button>
          <button class="a-btn a-btn-danger" id="adminResetAllBtn">Reset all house data to defaults</button>
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
  document.getElementById("appSearchInput").addEventListener("input", renderTickets);
  document.getElementById("appDeptFilter").addEventListener("change", renderTickets);

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

    document.getElementById("addStaffBtn").onclick = async () => {
      const nameInput = document.getElementById("staffNameInput");
      const passwordInput = document.getElementById("staffPasswordInput");
      const err = document.getElementById("staffFormError");
      err.style.display = "none";
      try {
        await Api.createStaff(nameInput.value.trim(), passwordInput.value, adminSecret);
        nameInput.value = "";
        passwordInput.value = "";
        await refreshStaff();
      } catch (e) {
        err.textContent = e.message;
        err.style.display = "block";
      }
    };

    renderStaffList();
  }

  renderStats();
  updateTabCounts();
  renderHouseTable();
  renderTickets();
}

renderGate();
