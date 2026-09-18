function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function deptCardHtml(dept) {
  return `
  <div class="house-card">
    <span class="house-card-corner house-card-corner-tl" aria-hidden="true"></span>
    <span class="house-card-corner house-card-corner-br" aria-hidden="true"></span>
    <div class="house-card-head">
      <div class="house-icon"><span class="house-icon-ring"></span>${DEPT_ICONS[dept.icon]}</div>
      <div class="house-card-heading"><h3 class="house-name">${dept.name}</h3></div>
    </div>
    <p class="house-desc">${dept.blurb}</p>
    <div class="house-card-footer">
      <button class="btn btn-primary btn-block" onclick="openApplyModal('${dept.key}')">Apply →</button>
    </div>
  </div>`;
}

function renderDeptGrid() {
  const grid = document.getElementById("deptGrid");
  grid.innerHTML = DEPARTMENTS.map(deptCardHtml).join("");
  scrollReveal(".house-card", grid);
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
        <div class="more-grid">
          <div class="field">
            <label>Roblox username</label>
            <div class="input-wrap">${DEPT_ICONS.badge}<input id="q_roblox" placeholder="Your Roblox username" /></div>
          </div>
          <div class="field">
            <label>Availability <span class="hint">(hours/week, timezone)</span></label>
            <div class="input-wrap">${DEPT_ICONS.clock}<input id="q_availability" placeholder="e.g. 10hrs/week, EST" /></div>
          </div>
        </div>
        <div class="field">
          <label>Attach an image <span class="hint">(optional: portfolio, screenshot, etc.)</span></label>
          <div class="avatar-field-row">
            <input type="file" id="q_image" accept="image/*" style="flex:1" />
            <img id="imagePreview" class="avatar-preview" alt="" hidden />
            <button type="button" class="field-clear" id="clearImageBtn" title="Remove image" hidden>${DEPT_ICONS.x}</button>
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

  document.getElementById("q_image").addEventListener("change", (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById("imagePreview");
    const clearBtn = document.getElementById("clearImageBtn");
    if (!file) {
      preview.hidden = true;
      clearBtn.hidden = true;
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result;
      preview.hidden = false;
    };
    reader.readAsDataURL(file);
    clearBtn.hidden = false;
  });

  document.getElementById("clearImageBtn").addEventListener("click", () => {
    document.getElementById("q_image").value = "";
    document.getElementById("imagePreview").hidden = true;
    document.getElementById("clearImageBtn").hidden = true;
  });

  document.querySelectorAll("[data-custom-select]").forEach((select) => wireCustomSelect(select.id));

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
  form.append("availability", fieldValue("q_availability"));
  form.append("why", why);
  form.append("answers", JSON.stringify(answers));
  const imageFile = document.getElementById("q_image").files[0];
  if (imageFile) form.append("image", imageFile);

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
