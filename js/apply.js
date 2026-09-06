function deptCardHtml(dept) {
  return `
  <div class="house-card" style="--card-color:${dept.color}">
    <div class="house-icon">${DEPT_ICONS[dept.icon]}</div>
    <h3 class="house-name">${dept.name}</h3>
    <p class="house-desc">${dept.blurb}</p>
    <button class="btn btn-primary btn-block" onclick="openApplyModal('${dept.key}')">Apply →</button>
  </div>`;
}

function renderDeptGrid() {
  const grid = document.getElementById("deptGrid");
  grid.innerHTML = DEPARTMENTS.map(deptCardHtml).join("");
  scrollReveal(".house-card", grid);
}

function questionFieldHtml(q) {
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

function openApplyModal(deptKey) {
  const dept = DEPARTMENTS.find((d) => d.key === deptKey);
  if (!dept) return;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal" style="--card-color:${dept.color}">
        <div class="modal-header">
          <div class="modal-crest">${DEPT_ICONS[dept.icon]}</div>
          <div>
            <div class="modal-kicker">Application</div>
            <h3>${dept.name}</h3>
          </div>
        </div>

        <div id="applyFormArea">
          <div class="field">
            <label>Roblox username</label>
            <div class="input-wrap">${DEPT_ICONS.badge}<input id="q_roblox" placeholder="Your Roblox username" /></div>
          </div>
          <div class="field">
            <label>Discord username</label>
            <div class="input-wrap">${DEPT_ICONS.chat}<input id="q_discord" placeholder="e.g. yourname" /></div>
          </div>
          <div class="field">
            <label>Availability <span class="hint">(hours/week, timezone)</span></label>
            <div class="input-wrap">${DEPT_ICONS.clock}<input id="q_availability" placeholder="e.g. 10hrs/week, EST" /></div>
          </div>

          <div class="field">
            <label>Attach an image <span class="hint">(optional: portfolio, screenshot, etc.)</span></label>
            <div class="avatar-field-row">
              <input type="file" id="q_image" accept="image/*" style="flex:1" />
              <img id="imagePreview" class="avatar-preview" alt="" hidden />
              <button type="button" class="field-clear" id="clearImageBtn" title="Remove image" hidden>${DEPT_ICONS.x}</button>
            </div>
          </div>

          ${dept.questions.map(questionFieldHtml).join("")}

          <div class="field">
            <label>Why do you want to join ${dept.name}?</label>
            <textarea id="q_why"></textarea>
          </div>

          <p class="error-text" id="applyError" style="display:none"></p>
          <div class="modal-actions">
            <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn btn-primary" onclick="submitApplication('${dept.key}')">Submit application</button>
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
}

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

function showSuccess(dept) {
  document.getElementById("applyFormArea").innerHTML = `
    <div class="empty-tree" style="padding:30px 0">
      Application sent! A ${dept.name} recruiter will follow up with you on Discord.
    </div>
    <div class="modal-actions">
      <button class="btn btn-primary" onclick="closeModal()">Done</button>
    </div>
  `;
}

async function submitApplication(deptKey) {
  const dept = DEPARTMENTS.find((d) => d.key === deptKey);
  const val = (id) => (document.getElementById(id) ? document.getElementById(id).value.trim() : "");

  const answers = {};
  dept.questions.forEach((q) => (answers[q.id] = val(`q_${q.id}`)));

  const roblox = val("q_roblox");
  const discord = val("q_discord");
  const why = val("q_why");

  const missing = [];
  if (!roblox) missing.push("Roblox username");
  if (!discord) missing.push("Discord username");
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
  form.append("discordUsername", discord);
  form.append("availability", val("q_availability"));
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
