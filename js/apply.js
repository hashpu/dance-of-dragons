function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const APPLY_LOCK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/></svg>`;

// Which departments have applications closed right now (see the admin
// dashboard's Applications tab) — fetched once on load. The server is the
// real gate (POST /api/applications rejects a closed department outright);
// this is just so the Apply page reflects that instead of letting someone
// fill out a whole form only to have it rejected at the end.
let closedDepartments = [];

function deptCardHtml(dept) {
  const closed = closedDepartments.includes(dept.key);
  return `
  <div class="house-card${closed ? " house-card-closed" : ""}">
    <span class="house-card-corner house-card-corner-tl" aria-hidden="true"></span>
    <span class="house-card-corner house-card-corner-br" aria-hidden="true"></span>
    ${closed ? `<span class="house-lock-badge" title="Applications closed">${APPLY_LOCK_ICON}</span>` : ""}
    <div class="house-card-head">
      <div class="house-icon"><span class="house-icon-ring"></span>${DEPT_ICONS[dept.icon]}</div>
      <div class="house-card-heading"><h3 class="house-name">${dept.name}</h3></div>
    </div>
    <p class="house-desc">${dept.blurb}</p>
    <div class="house-card-footer">
      ${
        closed
          ? `<button class="btn btn-outline btn-block" disabled>Applications Closed</button>`
          : `<button class="btn btn-primary btn-block" onclick="openApplyModal('${dept.key}')">Apply →</button>`
      }
    </div>
  </div>`;
}

// A featured department (currently just House Blackfyre HVC) gets its own
// wide banner below the regular grid instead of a slot inside it — the same
// pattern as the homepage's "Ready to rally one?" callout. Keeps it from
// landing as an odd one-card-alone row once the grid's column count doesn't
// divide evenly, and gives a character-roleplay application real weight
// instead of blending in with the generic staff department cards.
function featuredDeptHtml(dept) {
  const closed = closedDepartments.includes(dept.key);
  return `
  <div class="rally-cta featured-dept-cta">
    <div class="rally-cta-icon">${DEPT_ICONS[dept.icon]}</div>
    <div class="rally-cta-text">
      <strong>${dept.name}</strong>
      <p>${dept.blurb}</p>
    </div>
    ${
      closed
        ? `<button class="btn btn-outline" disabled>Applications Closed</button>`
        : `<button class="btn btn-primary" onclick="openApplyModal('${dept.key}')">Apply →</button>`
    }
  </div>`;
}

async function renderDeptGrid() {
  try {
    closedDepartments = await Api.getClosedDepartments();
  } catch (e) {
    closedDepartments = [];
  }

  const regular = DEPARTMENTS.filter((d) => !d.featured);
  const featured = DEPARTMENTS.filter((d) => d.featured);

  const grid = document.getElementById("deptGrid");
  grid.innerHTML = regular.map(deptCardHtml).join("");
  scrollReveal(".house-card", grid);

  const featuredSection = document.getElementById("featuredDeptSection");
  featuredSection.innerHTML = featured.length
    ? `<div class="eyebrow featured-dept-eyebrow">Character Roleplay</div>${featured.map(featuredDeptHtml).join("")}`
    : "";
}

function questionFieldHtml(q) {
  if (q.type === "yesno") {
    return `
      <div class="field">
        <label>${q.label}${q.required ? "" : ' <span class="hint">(optional)</span>'}</label>
        <div class="yesno-group">
          <label class="yesno-option">
            <input type="radio" name="q_${q.id}" value="Yes" />
            <span class="yesno-radio"></span>
            Yes
          </label>
          <label class="yesno-option">
            <input type="radio" name="q_${q.id}" value="No" />
            <span class="yesno-radio"></span>
            No
          </label>
        </div>
      </div>
    `;
  }
  if (q.type === "select") {
    return `
      <div class="field">
        <label>${q.label}${q.required ? "" : ' <span class="hint">(optional)</span>'}</label>
        <div class="input-wrap">
          <select id="q_${q.id}" data-custom-select>
            <option value="">Select one…</option>
            ${q.options.map((o) => `<option value="${o}">${o}</option>`).join("")}
          </select>
          <span class="chevron">${DEPT_ICONS.chevron}</span>
        </div>
      </div>
    `;
  }
  const field =
    q.type === "textarea"
      ? `<textarea id="q_${q.id}" placeholder="${q.placeholder || ""}"></textarea>`
      : `<input id="q_${q.id}" placeholder="${q.placeholder || ""}" />`;
  return `
    <div class="field">
      <label>${q.label}${q.required ? "" : ' <span class="hint">(optional)</span>'}</label>
      ${field}
    </div>
  `;
}

// Yes/No questions read from a checked radio in their name-group instead of
// a single element's value, unlike every other question type.
function questionValue(q) {
  if (q.type === "yesno") {
    const checked = document.querySelector(`input[name="q_${q.id}"]:checked`);
    return checked ? checked.value : "";
  }
  return document.getElementById(`q_${q.id}`).value.trim();
}

function fieldValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

// The hours-per-week slider and timezone select on the Basics step compose
// into the same single "availability" string the server has always stored
// — no schema change, just a nicer way to build that string than typing it
// by hand.
function availabilityValue() {
  const hoursEl = document.getElementById("q_availabilityHours");
  if (!hoursEl) return "";
  const hours = Number(hoursEl.value);
  const hoursLabel = hours >= 40 ? "40+ hrs/week" : `${hours} hrs/week`;
  const tz = fieldValue("q_availabilityTz");
  return tz ? `${hoursLabel}, ${tz}` : hoursLabel;
}

// Two consecutive short (non-textarea/yesno) questions sit side by side
// instead of stacking, to keep long forms from feeling endless. showHeading
// is off inside a wizard step, since the step's own progress label already
// names the section.
function questionsHtml(questions, showHeading) {
  let html = "";
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const heading = showHeading && i === 0 ? `<div class="form-section-heading">${q.section}</div>` : "";

    const isPairable = (type) => type !== "textarea" && type !== "yesno";
    const next = questions[i + 1];
    const canPair = isPairable(q.type) && next && isPairable(next.type) && next.section === q.section;
    if (canPair) {
      html += heading + `<div class="more-grid">${questionFieldHtml(q)}${questionFieldHtml(next)}</div>`;
      i++;
      continue;
    }
    html += heading + questionFieldHtml(q);
  }
  return html;
}

// Groups a department's questions by their shared `section` label,
// preserving first-appearance order — the basis for one wizard step per
// section, instead of one endless scroll of every question at once.
function groupQuestionsBySection(questions) {
  const groups = [];
  questions.forEach((q) => {
    let group = groups.find((g) => g.section === q.section);
    if (!group) {
      group = { section: q.section, questions: [] };
      groups.push(group);
    }
    group.questions.push(q);
  });
  return groups;
}

// Starting an application now requires being signed in with Discord first
// — asked for here, right when they try to apply, rather than gating the
// whole page (browsing what departments exist doesn't need it).
async function openApplyModal(deptKey) {
  const dept = DEPARTMENTS.find((d) => d.key === deptKey);
  if (!dept) return;

  if (closedDepartments.includes(deptKey)) {
    await Dialog.alert({
      kicker: dept.name,
      title: "Applications closed",
      message: "This department isn't accepting applications right now. Check back later.",
      icon: "lock",
      cardColor: "var(--red)"
    });
    return;
  }

  if (typeof getDiscordUser !== "function" || !getDiscordUser()) {
    const ok = await Dialog.confirm({
      kicker: dept.name,
      title: "Sign in to apply",
      message: "You need to sign in with Discord before starting an application.",
      confirmText: "Sign in with Discord",
      icon: "discord",
      cardColor: "var(--red)"
    });
    if (ok) beginDiscordLogin();
    return;
  }

  // One wizard step per question section, plus a fixed first ("Basics") and
  // last ("Why you want to join") step — so a department with lots of
  // questions (e.g. House Blackfyre HVC) doesn't become one endless scroll.
  // A small department still gets a short, quick multi-step flow rather
  // than a special-cased single page, so every application feels the same.
  const sections = groupQuestionsBySection(dept.questions);
  const steps = [
    { title: "Basics", type: "basics" },
    ...sections.map((s) => ({ title: s.section, type: "section", questions: s.questions })),
    { title: "Why You Want to Join", type: "why" }
  ];

  const stepBodyHtml = (step, i) => {
    if (step.type === "basics") {
      return `
        <div class="field">
          <label>Roblox username</label>
          <div class="input-wrap">${DEPT_ICONS.badge}<input id="q_roblox" placeholder="Your Roblox username" /></div>
        </div>

        <div class="field">
          <label>Availability</label>
          <div class="availability-picker">
            <div class="availability-hours">
              <div class="availability-hours-row">
                <span class="availability-hours-icon">${DEPT_ICONS.clock}</span>
                <span class="availability-hours-label">Hours per week</span>
                <span class="availability-hours-value" id="availHoursValue">10 hrs/week</span>
              </div>
              <input type="range" id="q_availabilityHours" min="1" max="40" step="1" value="10" />
            </div>
            <div class="input-wrap">
              ${DEPT_ICONS.globe}
              <select id="q_availabilityTz" data-custom-select>
                <option value="">Timezone (optional)</option>
                <option value="PST">Pacific (PST, UTC-8)</option>
                <option value="MST">Mountain (MST, UTC-7)</option>
                <option value="CST">Central (CST, UTC-6)</option>
                <option value="EST">Eastern (EST, UTC-5)</option>
                <option value="UTC">UTC / GMT (UTC+0)</option>
                <option value="CET">Central Europe (CET, UTC+1)</option>
                <option value="EET">Eastern Europe (EET, UTC+2)</option>
                <option value="IST">India (IST, UTC+5:30)</option>
                <option value="CHN">China / Singapore (UTC+8)</option>
                <option value="JST">Japan / Korea (JST/KST, UTC+9)</option>
                <option value="AEST">Australia Eastern (AEST, UTC+10)</option>
              </select>
              <span class="chevron">${DEPT_ICONS.chevron}</span>
            </div>
          </div>
        </div>
      `;
    }
    if (step.type === "why") {
      return `
        <div class="field">
          <label>Why do you want to join ${dept.name}?</label>
          <textarea id="q_why"></textarea>
        </div>
      `;
    }
    return questionsHtml(step.questions, false);
  };

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal modal-wide">
        <div class="modal-header">
          <div class="modal-crest">${DEPT_ICONS[dept.icon]}</div>
          <div>
            <div class="modal-kicker">Application</div>
            <h3>${dept.name}</h3>
          </div>
        </div>

        <div id="applyFormArea">
          <div class="applying-as">
            <img src="${discordAvatarUrl(getDiscordUser())}" alt="" />
            <div>
              <div class="hint">Applying as</div>
              <div class="applying-as-name">${escapeHtml(getDiscordUser().username)}</div>
            </div>
          </div>

          <div class="apply-progress">
            <div class="apply-progress-track"><div class="apply-progress-fill" id="applyProgressFill"></div></div>
            <div class="apply-progress-label" id="applyProgressLabel"></div>
          </div>

          ${steps.map((step, i) => `<div class="apply-step" data-step="${i}"${i === 0 ? "" : " hidden"}>${stepBodyHtml(step, i)}</div>`).join("")}

          <p class="error-text" id="applyError" style="display:none"></p>
          <div class="modal-actions">
            <button class="btn btn-outline" id="applyBackBtn"></button>
            <button class="btn btn-primary" id="applyNextBtn"></button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });

  document.querySelectorAll("[data-custom-select]").forEach((select) => wireCustomSelect(select.id));

  const hoursSlider = document.getElementById("q_availabilityHours");
  const hoursValueEl = document.getElementById("availHoursValue");
  function renderHoursSlider() {
    const val = Number(hoursSlider.value);
    hoursValueEl.textContent = val === 40 ? "40+ hrs/week" : `${val} hrs/week`;
    const pct = ((val - hoursSlider.min) / (hoursSlider.max - hoursSlider.min)) * 100;
    hoursSlider.style.background = `linear-gradient(to right, var(--card-color, var(--red)) ${pct}%, var(--surface-1) ${pct}%)`;
  }
  hoursSlider.addEventListener("input", renderHoursSlider);
  renderHoursSlider();

  const stepEls = Array.from(document.querySelectorAll(".apply-step"));
  const backBtn = document.getElementById("applyBackBtn");
  const nextBtn = document.getElementById("applyNextBtn");
  const progressFill = document.getElementById("applyProgressFill");
  const progressLabel = document.getElementById("applyProgressLabel");
  const applyErrorEl = document.getElementById("applyError");
  let currentStep = 0;

  function validateStep(i) {
    const step = steps[i];
    const missing = [];
    if (step.type === "basics") {
      if (!fieldValue("q_roblox")) missing.push("Roblox username");
    } else if (step.type === "why") {
      if (!fieldValue("q_why")) missing.push("Why you want to join");
    } else {
      step.questions.forEach((q) => {
        if (q.required && !questionValue(q)) missing.push(q.label);
      });
    }
    return missing;
  }

  function renderStep() {
    stepEls.forEach((el, i) => (el.hidden = i !== currentStep));
    progressFill.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
    progressLabel.textContent = `Step ${currentStep + 1} of ${steps.length} · ${steps[currentStep].title}`;
    backBtn.textContent = currentStep === 0 ? "Cancel" : "Back";
    nextBtn.textContent = currentStep === steps.length - 1 ? "Submit application" : "Next";
    applyErrorEl.style.display = "none";
  }

  backBtn.addEventListener("click", () => {
    if (currentStep === 0) {
      closeModal();
      return;
    }
    currentStep--;
    renderStep();
  });

  nextBtn.addEventListener("click", () => {
    const missing = validateStep(currentStep);
    if (missing.length) {
      applyErrorEl.textContent = "Please fill in: " + missing.join(", ");
      applyErrorEl.style.display = "block";
      return;
    }
    if (currentStep === steps.length - 1) {
      submitApplication(dept.key);
      return;
    }
    currentStep++;
    renderStep();
  });

  renderStep();
}

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

function showSuccess(dept) {
  document.getElementById("applyFormArea").innerHTML = `
    <div class="success-state">
      <div class="success-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>
      <h3>Application sent</h3>
      <p>A ${dept.name} recruiter will follow up with you on Discord.</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModal()">Done</button>
    </div>
  `;
}

async function submitApplication(deptKey) {
  if (typeof getDiscordUser !== "function" || !getDiscordUser()) {
    closeModal();
    const ok = await Dialog.confirm({
      title: "Sign in to apply",
      message: "You need to sign in with Discord before submitting an application.",
      confirmText: "Sign in with Discord",
      icon: "discord",
      cardColor: "var(--red)"
    });
    if (ok) beginDiscordLogin();
    return;
  }

  const dept = DEPARTMENTS.find((d) => d.key === deptKey);

  const answers = {};
  dept.questions.forEach((q) => (answers[q.id] = questionValue(q)));

  const roblox = fieldValue("q_roblox");
  const why = fieldValue("q_why");

  const missing = [];
  if (!roblox) missing.push("Roblox username");
  if (!why) missing.push("Why you want to join");
  dept.questions.forEach((q) => {
    if (q.required && !answers[q.id]) missing.push(q.label);
  });

  if (missing.length) {
    const err = document.getElementById("applyError");
    err.textContent = "Please fill in: " + missing.join(", ");
    err.style.display = "block";
    return;
  }

  const form = new FormData();
  form.append("department", deptKey);
  form.append("robloxUsername", roblox);
  form.append("availability", availabilityValue());
  form.append("why", why);
  form.append("answers", JSON.stringify(answers));

  try {
    await Api.submitApplication(form);
    showSuccess(dept);
  } catch (e) {
    const err = document.getElementById("applyError");
    err.textContent = e.message;
    err.style.display = "block";
  }
}

renderDeptGrid();
