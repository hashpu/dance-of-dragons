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

// Applications hold fully public, unauthenticated free text (anyone can
// submit one) that ends up rendered inside a privileged admin session that
// holds the admin secret in memory — so every submitted field gets escaped
// before it touches innerHTML, unlike some of the site's other, lower-stakes
// user text.
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const CHEVRON_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`;

function renderGate(errorMessage) {
  document.getElementById("adminRoot").innerHTML = `
    <div class="locked-card">
      <div class="lock-icon">🔒</div>
      <h3>Admin access required</h3>
      <p>Enter the admin secret to view house locks and submitted applications.</p>
      <div class="unlock-row">
        <input type="password" id="adminSecretInput" placeholder="Admin secret" autocomplete="off" />
        <button class="btn btn-primary" id="adminUnlockBtn">Unlock</button>
      </div>
      <p class="error-text" id="adminGateError" style="${errorMessage ? "" : "display:none"}">${escapeHtml(errorMessage || "")}</p>
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
    const [houses, applications] = await Promise.all([Api.adminGetHouses(secret), Api.getApplications(secret)]);
    adminSecret = secret;
    renderDashboard(houses, applications);
  } catch (e) {
    renderGate(e.message);
  }
}

async function refreshHouses() {
  const houses = await Api.adminGetHouses(adminSecret);
  document.getElementById("adminHousesList").innerHTML = `<div class="admin-houses-grid">${houses.map(houseAdminRowHtml).join("")}</div>`;
  bindHouseActions();
}

async function refreshApplications() {
  const applications = await Api.getApplications(adminSecret);
  renderTickets(applications);
}

function lordSummary(h) {
  if (h.lordDiscordUserId) return "Lord: Discord ID";
  if (h.lordRoleId) return "Lord: role + Roblox";
  return "No Lord assigned";
}

function houseAdminRowHtml(h) {
  const isLordSet = Boolean(h.lordDiscordUserId || h.lordRoleId);
  return `
    <div class="admin-house-row">
      <div class="admin-house-main">${escapeHtml(h.name)}</div>
      <div class="admin-house-status">
        <span class="status-pill ${h.locked ? "status-pill-locked" : "status-pill-unlocked"}">
          <span class="dot"></span>${h.locked ? "Locked" : "Unlocked"}
        </span>
        <span class="status-pill">${h.hasPassword ? "Password set" : "No password"}</span>
        <span class="status-pill ${isLordSet ? "status-pill-lord" : ""}">${lordSummary(h)}</span>
        <span class="status-pill">${h.memberCount} member${h.memberCount === 1 ? "" : "s"}</span>
      </div>
      <div class="admin-house-actions">
        ${h.locked ? `<button class="btn-link" data-action="clear-lock" data-slug="${h.slug}">Clear lock</button>` : ""}
        <button class="btn-link admin-danger-link" data-action="delete-house" data-slug="${h.slug}">Delete house</button>
      </div>
    </div>
  `;
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
}

function ticketAnswersHtml(dept, answers) {
  const entries = dept ? dept.questions.map((q) => [q.label, answers[q.id], q.type === "textarea"]) : Object.entries(answers).map(([k, v]) => [k, v, String(v || "").length > 60]);

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
  const color = dept ? dept.color : "var(--muted)";
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
          <button class="btn btn-danger-outline" data-action="dismiss-ticket" data-id="${app.id}">Dismiss ticket</button>
        </div>
      </div>
    </details>
  `;
}

function renderTickets(applications) {
  const el = document.getElementById("adminTicketsList");
  el.innerHTML = applications.length
    ? applications.map(ticketHtml).join("")
    : `<p class="empty-state">No applications submitted yet.</p>`;

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

function renderDashboard(houses, applications) {
  document.getElementById("adminRoot").innerHTML = `
    <section class="admin-section">
      <h2 class="admin-section-title">Houses &amp; locks</h2>
      <p class="admin-section-desc">
        Passwords are only ever stored as one-way hashes, so even here there's nothing to reveal, just
        whether one is set. Clearing a lock removes it entirely; the house can then be locked again with
        a new password.
      </p>
      <div id="adminHousesList"><div class="admin-houses-grid">${houses.map(houseAdminRowHtml).join("")}</div></div>
    </section>

    <section class="admin-section">
      <h2 class="admin-section-title">Applications</h2>
      <p class="admin-section-desc">Every submitted application, newest first. Expand one to see its full answers.</p>
      <div id="adminTicketsList"></div>
    </section>

    <details class="admin-tools">
      <summary><span class="chev">${CHEVRON_ICON}</span> Site maintenance</summary>
      <div class="admin-tools-actions">
        <button class="btn-link" id="adminSeedMissingBtn">Add any new houses (safe, doesn't touch existing data)</button>
        <button class="btn-link admin-danger-link" id="adminResetAllBtn">Reset all house data to defaults</button>
      </div>
    </details>
  `;

  renderTickets(applications);
  bindHouseActions();

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
}

renderGate();
