const params = new URLSearchParams(location.search);
const slug = params.get("h");

let house = null;

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

// Kept only in this page's memory — never in localStorage/sessionStorage —
// so a locked house's password only grants access for the current page
// visit. Reload, navigate away, or come back later and it's gone; the
// house asks for the password again every time.
let sessionPassword = null;

function renderHeader() {
  document.title = `${house.name} · Family Tree`;
  document.getElementById("houseHeader").innerHTML = `
    <div class="house-banner" style="--card-color:${house.color}">
      <div class="house-icon house-icon-lg" style="background:color-mix(in srgb, ${house.color} 18%, transparent); border-color:color-mix(in srgb, ${house.color} 45%, transparent);">${HOUSE_ICONS[house.slug]}</div>
      <h1>${entityLabel(house)}</h1>
      <p class="house-tagline">${house.tagline}</p>
    </div>
  `;
}

function renderStatus() {
  const el = document.getElementById("statusArea");
  if (house.locked && sessionPassword) {
    el.innerHTML = `
      <div class="banner banner-lord">
        <div class="banner-left"><span class="dot dot-lord"></span> Unlocked for this visit. You'll need ${entityLabel(house)}'s password again next time you come back.</div>
      </div>
    `;
  } else if (house.locked && house.lordAccess) {
    el.innerHTML = `
      <div class="banner banner-lord">
        <div class="banner-left"><span class="dot dot-lord"></span> You're recognized as this ${house.faction === "CROWN" ? "order's" : "house's"} ${leaderTitle(house)}, locked for everyone else. You can add new members below, but editing or removing existing ones needs the house password.</div>
        <button class="btn btn-outline" id="changePasswordBtn">Change password</button>
      </div>
    `;
    document.getElementById("changePasswordBtn").onclick = changeLordPassword;
  } else if (house.locked) {
    el.innerHTML = `
      <div class="locked-card" style="--card-color:${house.color}">
        <div class="lock-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/></svg></div>
        <h3>This tree is locked</h3>
        <p>Enter ${entityLabel(house)}'s password to view its family tree.</p>
        <div class="unlock-row">
          <input type="password" id="unlockInput" placeholder="House password" />
          <button class="btn btn-primary" id="unlockBtn">Unlock</button>
        </div>
        <p class="error-text" id="unlockError" style="display:none"></p>
      </div>
    `;
    document.getElementById("unlockBtn").onclick = tryUnlock;
    document.getElementById("unlockInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") tryUnlock();
    });
    document.getElementById("treeArea").innerHTML = "";
  } else {
    el.innerHTML = `
      <div class="banner banner-unlocked">
        <div class="banner-left"><span class="dot"></span> Unlocked. You can add or remove members below.</div>
        <button class="btn btn-outline" id="lockBtn">Lock</button>
      </div>
    `;
    document.getElementById("lockBtn").onclick = lockHouse;
  }
}

async function refresh() {
  house = await Api.getHouse(slug, sessionPassword);
  renderHeader();
  renderStatus();
  renderTree();
  applyHighlight();
}

function applyHighlight() {
  const highlightId = params.get("highlight");
  if (!highlightId) return;
  const el = document.querySelector(`[data-member-id="${highlightId}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("node-highlight");
  setTimeout(() => el.classList.remove("node-highlight"), 3000);
}

async function tryUnlock() {
  const input = document.getElementById("unlockInput");
  try {
    house = await Api.unlockHouse(slug, input.value);
    sessionPassword = input.value;
    renderHeader();
    renderStatus();
    renderTree();
    applyHighlight();
  } catch (e) {
    const err = document.getElementById("unlockError");
    err.textContent = e.message;
    err.style.display = "block";
  }
}

async function lockHouse() {
  try {
    await Api.lockHouse(slug, null);
  } catch (e) {
    const pw = await Dialog.prompt({
      kicker: entityLabel(house),
      title: "Set a password",
      message: "This password protects the family tree the first time it's locked.",
      label: "House password",
      type: "password",
      placeholder: "••••••••",
      confirmText: "Lock"
    });
    if (!pw) return;
    try {
      await Api.lockHouse(slug, pw);
    } catch (e2) {
      await Dialog.alert({ title: "Couldn't lock", message: e2.message, icon: "warning", cardColor: "var(--red)" });
      return;
    }
  }
  await refresh();
}

// Self-service password rotation for a Discord-recognized Lord — no need to
// know the current password (it may be the whole reason they're changing
// it) or ask an admin for the secret. Uses the same Discord bearer token
// that already proved their Lord access, so it just works if they're
// already signed in — no extra sign-in prompt.
async function changeLordPassword() {
  const pw = await Dialog.prompt({
    kicker: entityLabel(house),
    title: "Change password",
    message: `Sets a brand-new password for ${entityLabel(house)} right away. The old password stops working immediately.`,
    label: "New password",
    type: "password",
    placeholder: "••••••••",
    confirmText: "Change password",
    cardColor: house.color
  });
  if (!pw) return;
  try {
    await Api.setLordPassword(slug, pw);
  } catch (e) {
    await Dialog.alert({ title: "Couldn't change password", message: e.message, icon: "warning", cardColor: "var(--red)" });
    return;
  }
  await Dialog.alert({
    title: "Password changed",
    message: `${entityLabel(house)}'s password has been updated.`,
    icon: "lock",
    cardColor: house.color
  });
  await refresh();
}

function buildForest(members) {
  // A parentId that doesn't match anyone in this house's own list means the
  // parent belongs to a different house (married in) — treat that member as
  // a root here too, since there's no local node to nest them under.
  const localIds = new Set(members.map((m) => m.id));

  // A member with no parent of their own who points to a local spouse
  // (spouseId set on their OWN row, not just resolved via reverse — see the
  // server's toMemberJson comment) doesn't get an independent slot in the
  // tree. They're rendered paired inside their spouse's own box instead, so
  // whichever member DOES have a real position (a parentId, or a genuine
  // root founder) keeps it. Checking spouseId rather than the resolved
  // `spouse` object matters here: a root founder's spouse also resolves via
  // reverse lookup, but the founder must never be excluded just because
  // someone married into the house next to them.
  const pairedSpouseFor = {};
  members.forEach((m) => {
    if (!m.parentId && m.spouseId && localIds.has(m.spouseId)) {
      pairedSpouseFor[m.spouseId] = m;
    }
  });
  const excludedIds = new Set(Object.values(pairedSpouseFor).map((m) => m.id));

  const byParent = {};
  members.forEach((m) => {
    if (excludedIds.has(m.id)) return;
    const key = m.parentId && localIds.has(m.parentId) ? m.parentId : "root";
    (byParent[key] = byParent[key] || []).push(m);
  });
  function attach(m) {
    const children = (byParent[m.id] || []).map(attach);
    return { ...m, children, pairedSpouse: pairedSpouseFor[m.id] || null };
  }
  return (byParent.root || []).map(attach);
}

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}

const PENCIL_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 4.5l3 3L7 20H4v-3z"/></svg>`;
const CROWN_BADGE_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 8l4.5 3L12 4l4.5 7L21 8l-2 11H5L3 8zm4 12h10v1.5H7V20z"/></svg>`;
const NODE_HEART_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20.3s-7.2-4.4-9.4-8.7C1.2 8.4 2.8 5 6.2 5c2 0 3.4 1.2 5.8 4 2.4-2.8 3.8-4 5.8-4 3.4 0 5 3.4 3.6 6.6-2.2 4.3-9.4 8.7-9.4 8.7z"/></svg>`;

// A Lord recognized via Discord (no password) can only add new members —
// editing or removing an existing one needs the house password, same as
// anyone else. Set fresh each render from the current house/session state.
let lordOnlyAccess = false;

// Staggers each node's entrance animation on render — reset per render pass.
let nodeRenderIndex = 0;

// The single-person card content shared by a normal node and each half of a
// married couple's paired node — everything except the outer .node wrapper,
// the "Child of" line, and the add-child/add-spouse buttons, all of which
// belong to whichever member actually holds the tree position (see
// nodeHtml), not to a spouse who only married in.
function personCardHtml(person) {
  const fallback = generatedAvatar(person.name, house.color);
  const avatar = person.avatarUrl || fallback;
  const avatarImg = `<img class="node-avatar" src="${avatar}" alt="${person.name}" onerror="this.onerror=null;this.src='${fallback}'" />`;
  const avatarHtml = person.robloxProfile
    ? `<a href="${escapeAttr(person.robloxProfile)}" target="_blank" rel="noopener" title="Open Roblox profile">${avatarImg}</a>`
    : avatarImg;
  const role = person.role ? `<div class="node-role">${person.role}</div>` : `<div class="node-role">&nbsp;</div>`;
  const nameTitle = person.note ? ` title="${escapeAttr(person.note)}"` : "";
  const linksHtml = `
    ${person.buildLink ? `<a class="node-build-link" href="${escapeAttr(person.buildLink)}" target="_blank" rel="noopener">Roblox build ↗</a>` : ""}
    ${person.robloxProfile ? `<a class="node-build-link" href="${escapeAttr(person.robloxProfile)}" target="_blank" rel="noopener">Roblox profile ↗</a>` : ""}
    ${person.discordId ? `<div class="node-discord">${FIELD_ICONS.discord} ${escapeAttr(person.discordId)}</div>` : ""}
  `;
  const editRemoveButtons = lordOnlyAccess
    ? ""
    : `
      <button class="node-edit" title="Edit" onclick="openEditModal('${person.id}')">${PENCIL_ICON}</button>
      <button class="node-remove" title="Remove" onclick="handleRemove('${person.id}')">✕</button>
    `;
  return `
    <div class="node-person">
      ${editRemoveButtons}
      ${avatarHtml}
      <div class="node-name"${nameTitle}>${person.name}</div>
      ${role}
      ${linksHtml}
    </div>
  `;
}

function nodeHtml(node) {
  const i = nodeRenderIndex++;
  const isRoot = !node.parentId;
  const externalParentHtml = node.externalParent
    ? `<a class="node-external-link" href="/house?h=${node.externalParent.houseSlug}&highlight=${node.parentId}">Child of ${node.externalParent.name} · ${entityLabel({ name: node.externalParent.houseName, faction: node.externalParent.houseFaction })}</a>`
    : "";
  const childrenHtml = node.children.length
    ? `<ul>${node.children.map((c) => `<li>${nodeHtml(c)}</li>`).join("")}</ul>`
    : "";

  const spouse = node.pairedSpouse;
  const bodyHtml = spouse
    ? `
      <div class="node-spouse-row">
        ${personCardHtml(node)}
        <div class="node-spouse-divider" title="Married">${NODE_HEART_ICON}</div>
        ${personCardHtml(spouse)}
      </div>
    `
    : personCardHtml(node);

  // A real spouse relationship that couldn't get the paired-box treatment —
  // most often because they belong to a different house's tree entirely
  // (there's no node here to pair with), occasionally because they happen
  // to have their own tracked parent in this same house too. Either way,
  // the marriage still deserves a mention instead of silently not
  // appearing anywhere.
  const unpairedSpouseHtml =
    !spouse && node.spouse
      ? node.spouse.houseSlug
        ? `<a class="node-external-link" href="/house?h=${node.spouse.houseSlug}&highlight=${node.spouse.id}">Married to ${node.spouse.name} · ${entityLabel({ name: node.spouse.houseName, faction: node.spouse.houseFaction })}</a>`
        : `<div class="node-external-link">Married to ${node.spouse.name}</div>`
      : "";

  const addSpouseBtn =
    !node.spouse && !lordOnlyAccess
      ? `<button class="btn btn-outline" onclick="openAddSpouseFlow('${node.id}')">+ add spouse</button>`
      : "";

  return `
    <div class="node${isRoot ? " node-root" : ""}${spouse ? " node-paired" : ""}" data-member-id="${node.id}" style="--node-i:${i}">
      ${isRoot ? `<div class="node-crown-badge" title="Head of House">${CROWN_BADGE_ICON}</div>` : ""}
      ${bodyHtml}
      ${externalParentHtml}
      ${unpairedSpouseHtml}
      <div class="node-actions-row">
        <button class="btn btn-danger-outline" onclick="openAddModal('${node.id}')">+ add child</button>
        ${addSpouseBtn}
      </div>
    </div>
    ${childrenHtml}
  `;
}

function renderTree() {
  const el = document.getElementById("treeArea");
  if (house.locked && !house.lordAccess && !sessionPassword) return;
  lordOnlyAccess = house.locked && house.lordAccess && !sessionPassword;
  nodeRenderIndex = 0;

  const forest = buildForest(house.members);
  const toolbar = `
    <div class="panel-toolbar">
      <button class="btn btn-primary" onclick="openAddModal(null)">+ Add family member</button>
    </div>
  `;

  if (!forest.length) {
    el.innerHTML = `
      ${toolbar}
      <div class="tree-panel" style="--card-color:${house.color}">
        <div class="empty-tree">No members yet. Be the first to add one to ${entityLabel(house)}.</div>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    ${toolbar}
    <div class="tree-panel" style="--card-color:${house.color}">
      <ul class="tree">
        ${forest.map((n) => `<li>${nodeHtml(n)}</li>`).join("")}
      </ul>
    </div>
  `;
}

function getDescendantIds(memberId) {
  const ids = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    house.members.forEach((m) => {
      if (m.parentId && (m.parentId === memberId || ids.has(m.parentId)) && !ids.has(m.id)) {
        ids.add(m.id);
        changed = true;
      }
    });
  }
  return ids;
}

async function handleRemove(memberId) {
  const descendants = getDescendantIds(memberId).size;
  const msg =
    descendants > 0
      ? `Remove this member and their ${descendants} descendant${descendants > 1 ? "s" : ""}? This can't be undone.`
      : "Remove this member? This can't be undone.";
  const ok = await Dialog.confirm({
    title: "Remove member?",
    message: msg,
    confirmText: "Remove",
    danger: true
  });
  if (!ok) return;

  try {
    await Api.removeMember(slug, memberId, sessionPassword);
    closeModal();
    await refresh();
  } catch (e) {
    await Dialog.alert({ title: "Couldn't remove", message: e.message, icon: "warning", cardColor: "var(--red)" });
  }
}

const ROLE_GROUPS = [
  {
    label: "Royal",
    titles: [
      "King of the Seven Kingdoms",
      "Queen Of The Seven Kingdoms",
      "King Consort Of The Seven Kingdoms",
      "Queen Consort of the Realm",
      "Prince of Dragonstone",
      "Royal Family",
      "Royal Prince / Princess",
      "Dragon Dynasty"
    ]
  },
  {
    label: "Council",
    titles: [
      "Hand of the King",
      "Master of Coin",
      "Master of Laws",
      "Master of Whisperers",
      "Master of Ships",
      "Master of War",
      "Grand Maester",
      "Small Council",
      "King / Queen's Court"
    ]
  },
  {
    label: "Realm",
    titles: [
      "Lord/Lady Paramount",
      "Lord / Lady",
      "Heir/Heiress",
      "Highborn",
      "Wellborn",
      "Lowborn",
      "Married"
    ]
  }
];

const ROLE_CUSTOM_VALUE = "__custom__";

function roleFieldHtml(currentRole) {
  const allTitles = ROLE_GROUPS.flatMap((g) => g.titles);
  const isCustom = !!currentRole && !allTitles.includes(currentRole);

  const optgroups = ROLE_GROUPS.map(
    (g) =>
      `<optgroup label="${g.label}">${g.titles
        .map((t) => `<option value="${escapeAttr(t)}"${t === currentRole ? " selected" : ""}>${t}</option>`)
        .join("")}</optgroup>`
  ).join("");

  return `
    <div class="field">
      <label>Role / title <span class="hint">(optional)</span></label>
      <div class="input-wrap">
        ${FIELD_ICONS.crown}
        <select id="fRoleSelect">
          <option value=""${!currentRole ? " selected" : ""}>No title</option>
          ${optgroups}
          <option value="${ROLE_CUSTOM_VALUE}"${isCustom ? " selected" : ""}>Custom / other…</option>
        </select>
        <span class="chevron">${FIELD_ICONS.chevron}</span>
      </div>
      <div class="field-custom-wrap" id="fRoleCustomWrap"${isCustom ? "" : " hidden"}>
        <input id="fRoleCustom" placeholder="Type a custom title" value="${isCustom ? escapeAttr(currentRole) : ""}" />
      </div>
    </div>
  `;
}

const NOTE_CUSTOM_VALUE = "__custom__";

// A plain free-text box made people type "Married into House X" by hand —
// inconsistent, and easy to get wrong. This picks the actual house instead,
// excluding whichever house the member is being added to (marrying into
// your own house doesn't mean anything), and generates the same note text
// that used to be typed by hand. "Custom note…" still exists as an escape
// hatch for anything that isn't a same-site house (e.g. a smallfolk family,
// or a house not tracked here).
function marriedInFieldHtml(currentNote, houses, currentHouseSlug) {
  const eligibleHouses = houses.filter((h) => h.slug !== currentHouseSlug);
  const matchedHouse = eligibleHouses.find((h) => currentNote === `Married into ${entityLabel(h)}`);
  const isCustom = !!currentNote && !matchedHouse;

  const options = eligibleHouses
    .map((h) => `<option value="${h.slug}"${matchedHouse && matchedHouse.slug === h.slug ? " selected" : ""}>${escapeAttr(h.name)}</option>`)
    .join("");

  return `
    <div class="field">
      <label>Married in from <span class="hint">(optional)</span></label>
      <div class="input-wrap">
        ${FIELD_ICONS.heart}
        <select id="fNoteHouseSelect">
          <option value=""${!currentNote ? " selected" : ""}>Not married in</option>
          ${options}
          <option value="${NOTE_CUSTOM_VALUE}"${isCustom ? " selected" : ""}>Custom note…</option>
        </select>
        <span class="chevron">${FIELD_ICONS.chevron}</span>
      </div>
      <div class="field-custom-wrap" id="fNoteCustomWrap"${isCustom ? "" : " hidden"}>
        <input id="fNoteCustom" placeholder="e.g. Married into the family" value="${isCustom ? escapeAttr(currentNote) : ""}" />
      </div>
    </div>
  `;
}

const FIELD_ICONS = {
  user: `<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c1-4.2 4.6-6 7.5-6s6.5 1.8 7.5 6"/></svg>`,
  tree: `<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="M12 7.2V12M12 12L6.8 16.8M12 12l5.2 4.8"/></svg>`,
  crown: `<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18h16l-1.4-8.2-4.1 3.6L12 6.5 9.5 13.4 5.4 9.8 4 18z"/></svg>`,
  link: `<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 14.5l5-5"/><path d="M8 13a3.5 3.5 0 010-5l2-2a3.5 3.5 0 015 5l-.8.8"/><path d="M16 11a3.5 3.5 0 010 5l-2 2a3.5 3.5 0 01-5-5l.8-.8"/></svg>`,
  image: `<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.4"/><path d="M20 15l-4.5-4.5L9 17"/></svg>`,
  heart: `<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.3s-7.2-4.4-9.4-8.7C1.2 8.4 2.8 5 6.2 5c2 0 3.4 1.2 5.8 4 2.4-2.8 3.8-4 5.8-4 3.4 0 5 3.4 3.6 6.6-2.2 4.3-9.4 8.7-9.4 8.7z"/></svg>`,
  badge: `<svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2.2"/><circle cx="12" cy="10" r="2.6"/><path d="M7.3 17c.9-2.3 2.7-3.4 4.7-3.4s3.8 1.1 4.7 3.4"/></svg>`,
  discord: `<svg class="field-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37a19.8 19.8 0 00-4.9-1.52.07.07 0 00-.08.04c-.21.38-.45.87-.61 1.26a18.3 18.3 0 00-5.48 0 12.6 12.6 0 00-.63-1.26.08.08 0 00-.08-.04 19.7 19.7 0 00-4.9 1.52.07.07 0 00-.03.03C1.24 9.05.47 13.58.83 18.06a.08.08 0 00.03.06 19.9 19.9 0 006 3.02.08.08 0 00.08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 00-.04-.11 13 13 0 01-1.88-.9.08.08 0 01-.01-.13c.13-.09.25-.19.37-.29a.07.07 0 01.08-.01c3.93 1.8 8.18 1.8 12.07 0a.08.08 0 01.08.01c.12.1.24.2.37.29a.08.08 0 010 .13c-.6.35-1.23.65-1.89.9a.08.08 0 00-.04.11c.37.7.78 1.37 1.23 2a.08.08 0 00.08.03 19.8 19.8 0 006.03-3.02.08.08 0 00.03-.06c.43-5.19-.72-9.68-3.05-13.66a.06.06 0 00-.03-.03zM8.52 15.3c-1.18 0-2.15-1.09-2.15-2.42 0-1.34.95-2.43 2.15-2.43 1.21 0 2.17 1.1 2.15 2.43 0 1.33-.95 2.42-2.15 2.42zm6.98 0c-1.18 0-2.15-1.09-2.15-2.42 0-1.34.95-2.43 2.15-2.43 1.21 0 2.17 1.1 2.15 2.43 0 1.33-.94 2.42-2.15 2.42z"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3"/></svg>`,
  chevron: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>`
};

// The member list currently backing the "who is their parent" (or spouse)
// dropdown — either this house's own members, or another house's, when the
// visitor picks a different house to link someone from (marrying in).
let parentPickerMembers = [];
let spousePickerMembers = [];
let parentPickerHouses = [];

async function loadPickerMembers(houseSlug) {
  if (houseSlug === slug) return house.members;
  try {
    const data = await Api.getHouse(houseSlug);
    return data.members || [];
  } catch (e) {
    return [];
  }
}

function excludedParentIds(houseSlug) {
  // Reparent loops are only possible within this same house's own tree —
  // a cross-house parent can never end up as one of this member's own
  // descendants.
  if (!editingMemberId || houseSlug !== slug) return new Set();
  return new Set([editingMemberId, ...getDescendantIds(editingMemberId)]);
}

function excludedSpouseIds(houseSlug) {
  // A spouse just can't be yourself — there's no loop risk like reparenting.
  if (!editingMemberId || houseSlug !== slug) return new Set();
  return new Set([editingMemberId]);
}

function personOptionsHtml(members, excluded, selectedId, noneLabel = "Nobody, they start a new branch") {
  const opts = [`<option value="">${noneLabel}</option>`];
  members
    .filter((m) => !excluded.has(m.id))
    .forEach((m) => opts.push(`<option value="${m.id}"${m.id === selectedId ? " selected" : ""}>${m.name}</option>`));
  return opts.join("");
}

function updateParentPreview() {
  const preview = document.getElementById("parentPreview");
  const val = document.getElementById("fParent").value;
  if (!val) {
    preview.className = "parent-preview empty";
    preview.textContent = "Starts a new branch of " + entityLabel(house);
    return;
  }
  const m = parentPickerMembers.find((x) => x.id === val);
  if (!m) return;
  const houseSlugSel = document.getElementById("fParentHouse").value;
  const pickedHouse = parentPickerHouses.find((h) => h.slug === houseSlugSel);
  const fallback = generatedAvatar(m.name, pickedHouse ? pickedHouse.color : house.color);
  const avatar = m.avatarUrl || fallback;
  const houseNote = houseSlugSel !== slug && pickedHouse ? ` (${entityLabel(pickedHouse)})` : "";
  preview.className = "parent-preview";
  preview.innerHTML = `<img src="${avatar}" alt="" onerror="this.onerror=null;this.src='${fallback}'" /> Child of <strong>${m.name}</strong>${m.role ? " · " + m.role : ""}${houseNote}`;
}

async function refreshParentPersonSelect(houseSlug, selectedId) {
  parentPickerMembers = await loadPickerMembers(houseSlug);
  const pickedHouse = parentPickerHouses.find((h) => h.slug === houseSlug);
  const personSelect = document.getElementById("fParent");
  personSelect.innerHTML = personOptionsHtml(parentPickerMembers, excludedParentIds(houseSlug), selectedId || "");
  const lockedHint = document.getElementById("parentHouseLockedHint");
  lockedHint.hidden = !(pickedHouse && pickedHouse.locked && !parentPickerMembers.length && pickedHouse.memberCount > 0);
  updateParentPreview();
}

async function refreshSpousePersonSelect(houseSlug, selectedId) {
  spousePickerMembers = await loadPickerMembers(houseSlug);
  const pickedHouse = parentPickerHouses.find((h) => h.slug === houseSlug);
  const personSelect = document.getElementById("fSpouse");
  personSelect.innerHTML = personOptionsHtml(spousePickerMembers, excludedSpouseIds(houseSlug), selectedId || "", "No spouse");
  const lockedHint = document.getElementById("spouseHouseLockedHint");
  lockedHint.hidden = !(pickedHouse && pickedHouse.locked && !spousePickerMembers.length && pickedHouse.memberCount > 0);
}

let editingMemberId = null;

async function openAddModal(parentId, presetSpouseId) {
  editingMemberId = null;
  await openMemberModal({ parentId, member: null, presetSpouseId });
}

async function openEditModal(memberId) {
  editingMemberId = memberId;
  const member = house.members.find((m) => m.id === memberId);
  if (!member) return;
  await openMemberModal({ parentId: member.parentId, member });
}

// Fast path for a spouse who's an actual Discord member of the server —
// search-and-pick (only accounts that have signed in here before show up,
// same picker the admin dashboard uses for Lord assignment) instead of
// filling out the whole add-member form by hand. Most spouses on a lore
// site like this one won't have a real Discord account at all (or just
// haven't signed in yet) — "Add them manually instead" falls back to the
// regular Add Family Member form, with this member preselected as the
// spouse, so a raw Discord ID can still be typed in there if wanted.
async function openAddSpouseFlow(memberId) {
  const member = house.members.find((m) => m.id === memberId);
  if (!member) return;

  const result = await Dialog.search({
    kicker: entityLabel(house),
    title: `Add ${member.name}'s spouse`,
    message: "Search a Discord account that's signed in here before, or add them manually if they haven't (or don't need one).",
    fetchResults: (query) => Api.searchHouseDiscordUsers(slug, query, sessionPassword),
    allowManual: true,
    manualLabel: "Add them manually instead"
  });
  if (!result) return;

  if (result.manual) {
    await openAddModal(null, memberId);
    return;
  }

  try {
    await Api.addMember(
      slug,
      {
        name: result.username,
        discordId: result.id,
        spouseId: memberId,
        parentId: null,
        role: "",
        avatarUrl: discordAvatarUrl(result),
        buildLink: "",
        robloxProfile: "",
        note: ""
      },
      sessionPassword
    );
    await refresh();
  } catch (e) {
    await Dialog.alert({ title: "Couldn't add spouse", message: e.message, icon: "warning", cardColor: "var(--red)" });
  }
}

async function openMemberModal({ parentId, member, presetSpouseId }) {
  const isEdit = !!member;
  parentPickerHouses = await Api.getHouses();
  const initialHouseSlug = isEdit && member.externalParent ? member.externalParent.houseSlug : slug;
  parentPickerMembers = await loadPickerMembers(initialHouseSlug);

  const houseOptions = parentPickerHouses
    .map((h) => `<option value="${h.slug}"${h.slug === initialHouseSlug ? " selected" : ""}>${h.name}</option>`)
    .join("");
  const initialHouse = parentPickerHouses.find((h) => h.slug === initialHouseSlug);
  const showLockedHint = initialHouse && initialHouse.locked && !parentPickerMembers.length && initialHouse.memberCount > 0;

  // presetSpouseId comes from "+ add spouse"'s manual fallback — arriving
  // here already knowing who this new member is marrying, so that pairing
  // doesn't have to be re-picked by hand.
  //
  // Uses the resolved `spouse` here, not the raw `spouseId` — a member who's
  // only paired because someone ELSE points at them (see toMemberJsonList's
  // reverse lookup) has a null spouseId of their own, but editing them
  // should still show their actual partner selected, not "No spouse". The
  // server's clearReverseSpouseLinks makes saving from either side actually
  // end the pairing correctly either way.
  const initialSpouseId = isEdit && member.spouse ? member.spouse.id : presetSpouseId || "";
  const initialSpouseHouseSlug = isEdit && member.spouse && member.spouse.houseSlug ? member.spouse.houseSlug : slug;
  spousePickerMembers = await loadPickerMembers(initialSpouseHouseSlug);

  const spouseHouseOptions = parentPickerHouses
    .map((h) => `<option value="${h.slug}"${h.slug === initialSpouseHouseSlug ? " selected" : ""}>${h.name}</option>`)
    .join("");
  const initialSpouseHouse = parentPickerHouses.find((h) => h.slug === initialSpouseHouseSlug);
  const showSpouseLockedHint = initialSpouseHouse && initialSpouseHouse.locked && !spousePickerMembers.length && initialSpouseHouse.memberCount > 0;

  document.getElementById("modalRoot").innerHTML = `
    <div class="modal-overlay" id="modalOverlay">
      <div class="modal modal-wide" style="--card-color:var(--gold, #d4af37)">
        <div class="modal-header">
          <div class="modal-crest">${HOUSE_ICONS[house.slug]}</div>
          <div>
            <div class="modal-kicker">${entityLabel(house)}</div>
            <h3>${isEdit ? `Edit ${member.name}` : "Add a Family Member"}</h3>
          </div>
        </div>

        <div class="field">
          <label>Name</label>
          <div class="input-wrap">
            ${FIELD_ICONS.user}
            <input id="fName" placeholder="Who are you adding?" value="${isEdit ? escapeAttr(member.name) : ""}" />
          </div>
        </div>

        <div class="more-grid">
          <div class="field">
            <label>Parent's house <span class="hint">(pick another house to link a relative who married in)</span></label>
            <div class="input-wrap">
              ${FIELD_ICONS.tree}
              <select id="fParentHouse">${houseOptions}</select>
              <span class="chevron">${FIELD_ICONS.chevron}</span>
            </div>
          </div>

          ${roleFieldHtml(isEdit ? member.role || "" : "")}
        </div>

        <div class="field">
          <label>Who is their parent?</label>
          <div class="input-wrap">
            ${FIELD_ICONS.user}
            <select id="fParent">${personOptionsHtml(parentPickerMembers, excludedParentIds(initialHouseSlug), parentId)}</select>
            <span class="chevron">${FIELD_ICONS.chevron}</span>
          </div>
          <p class="hint" id="parentHouseLockedHint"${showLockedHint ? "" : " hidden"}>This house is locked, so its members aren't available to pick from.</p>
          <div class="parent-preview" id="parentPreview"></div>
        </div>

        <div class="more-grid">
          <div class="field">
            <label>Spouse's house <span class="hint">(pick another house if they married in from elsewhere)</span></label>
            <div class="input-wrap">
              ${FIELD_ICONS.tree}
              <select id="fSpouseHouse">${spouseHouseOptions}</select>
              <span class="chevron">${FIELD_ICONS.chevron}</span>
            </div>
          </div>
          <div class="field">
            <label>Spouse <span class="hint">(optional — pairs them together in the tree)</span></label>
            <div class="input-wrap">
              ${FIELD_ICONS.heart}
              <select id="fSpouse">${personOptionsHtml(spousePickerMembers, excludedSpouseIds(initialSpouseHouseSlug), initialSpouseId, "No spouse")}</select>
              <span class="chevron">${FIELD_ICONS.chevron}</span>
            </div>
            <p class="hint" id="spouseHouseLockedHint"${showSpouseLockedHint ? "" : " hidden"}>This house is locked, so its members aren't available to pick from.</p>
          </div>
        </div>

        <details class="more-options"${isEdit && (member.buildLink || member.robloxProfile || member.discordId || member.avatarUrl || member.note) ? " open" : ""}>
          <summary><span class="chev">${FIELD_ICONS.chevronRight}</span> More options <span class="hint">(photo, links, married-in note)</span></summary>
          <div class="more-grid">
            <div class="field">
              <label>Roblox build link</label>
              <div class="input-wrap">
                ${FIELD_ICONS.link}
                <input id="fBuildLink" placeholder="https://www.roblox.com/games/..." value="${isEdit ? escapeAttr(member.buildLink || "") : ""}" />
              </div>
            </div>
            <div class="field">
              <label>Roblox profile link</label>
              <div class="input-wrap">
                ${FIELD_ICONS.badge}
                <input id="fRobloxProfile" placeholder="https://www.roblox.com/users/.../profile" value="${isEdit ? escapeAttr(member.robloxProfile || "") : ""}" />
              </div>
            </div>
          </div>

          <div class="field">
            <label>Discord account ID <span class="hint">(the real person behind this character, optional)</span></label>
            <div class="input-wrap">
              ${FIELD_ICONS.discord}
              <input id="fDiscordId" placeholder="e.g. 123456789012345678" value="${isEdit ? escapeAttr(member.discordId || "") : ""}" />
            </div>
          </div>

          <div class="field">
            <label>Avatar photo or GIF <span class="hint">(upload a file, or paste an image/GIF URL)</span></label>
            <div class="avatar-field-row">
              <div class="input-wrap" style="flex:1">
                ${FIELD_ICONS.image}
                <input id="fAvatar" placeholder="https://... .png / .gif" value="${isEdit ? escapeAttr(member.avatarUrl || "") : ""}" />
              </div>
              <img id="avatarPreview" class="avatar-preview" alt="" hidden />
              <button type="button" class="field-clear" id="uploadAvatarBtn" title="Upload a photo or GIF">${FIELD_ICONS.upload}</button>
              <button type="button" class="field-clear" id="clearAvatarBtn" title="Remove photo" hidden>${FIELD_ICONS.x}</button>
              <input type="file" id="fAvatarFile" accept="image/png,image/jpeg,image/gif,image/webp" hidden />
            </div>
            <p class="error-text" id="avatarUploadError" style="display:none"></p>
          </div>

          ${marriedInFieldHtml(isEdit ? member.note || "" : "", parentPickerHouses, slug)}
        </details>

        <p class="error-text" id="fError" style="display:none"></p>
        <div class="modal-actions">
          ${isEdit ? `<button class="btn btn-danger-outline" style="margin-right:auto" onclick="handleRemove('${member.id}')">Remove</button>` : ""}
          <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="submitMember()">${isEdit ? "Save changes" : "+ Add member"}</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") closeModal();
  });
  document.getElementById("fParent").addEventListener("change", updateParentPreview);
  document.getElementById("fParentHouse").addEventListener("change", (e) => {
    refreshParentPersonSelect(e.target.value, "");
  });
  updateParentPreview();

  document.getElementById("fSpouseHouse").addEventListener("change", (e) => {
    refreshSpousePersonSelect(e.target.value, "");
  });

  document.getElementById("fRoleSelect").addEventListener("change", (e) => {
    const isCustom = e.target.value === ROLE_CUSTOM_VALUE;
    document.getElementById("fRoleCustomWrap").hidden = !isCustom;
    if (isCustom) document.getElementById("fRoleCustom").focus();
  });

  document.getElementById("fNoteHouseSelect").addEventListener("change", (e) => {
    const isCustom = e.target.value === NOTE_CUSTOM_VALUE;
    document.getElementById("fNoteCustomWrap").hidden = !isCustom;
    if (isCustom) document.getElementById("fNoteCustom").focus();
  });

  document.getElementById("fAvatar").addEventListener("input", updateAvatarPreview);
  document.getElementById("clearAvatarBtn").addEventListener("click", () => {
    document.getElementById("fAvatar").value = "";
    updateAvatarPreview();
  });
  document.getElementById("uploadAvatarBtn").addEventListener("click", () => {
    document.getElementById("fAvatarFile").click();
  });
  document.getElementById("fAvatarFile").addEventListener("change", handleAvatarFileChange);
  updateAvatarPreview();

  document.getElementById("fName").focus();
}

async function handleAvatarFileChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  const uploadBtn = document.getElementById("uploadAvatarBtn");
  const err = document.getElementById("avatarUploadError");
  err.style.display = "none";
  uploadBtn.disabled = true;
  const originalHtml = uploadBtn.innerHTML;
  uploadBtn.innerHTML = "…";

  try {
    const { url } = await Api.uploadAvatar(slug, file, sessionPassword);
    document.getElementById("fAvatar").value = url;
    updateAvatarPreview();
  } catch (ex) {
    err.textContent = ex.message;
    err.style.display = "block";
  } finally {
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = originalHtml;
    e.target.value = "";
  }
}

function updateAvatarPreview() {
  const url = document.getElementById("fAvatar").value.trim();
  const img = document.getElementById("avatarPreview");
  const clearBtn = document.getElementById("clearAvatarBtn");
  if (!url) {
    img.hidden = true;
    img.src = "";
    clearBtn.hidden = true;
    return;
  }
  img.src = url;
  img.hidden = false;
  clearBtn.hidden = false;
}

function closeModal() {
  document.getElementById("modalRoot").innerHTML = "";
}

async function submitMember() {
  const name = document.getElementById("fName").value.trim();
  const parentId = document.getElementById("fParent").value || null;
  const spouseId = document.getElementById("fSpouse").value || null;
  const roleSelectVal = document.getElementById("fRoleSelect").value;
  const role = roleSelectVal === ROLE_CUSTOM_VALUE ? document.getElementById("fRoleCustom").value.trim() : roleSelectVal;
  const avatarUrl = document.getElementById("fAvatar").value.trim();
  const buildLink = document.getElementById("fBuildLink").value.trim();
  const robloxProfile = document.getElementById("fRobloxProfile").value.trim();
  const discordId = document.getElementById("fDiscordId").value.trim();
  const noteHouseVal = document.getElementById("fNoteHouseSelect").value;
  let note = "";
  if (noteHouseVal === NOTE_CUSTOM_VALUE) {
    note = document.getElementById("fNoteCustom").value.trim();
  } else if (noteHouseVal) {
    const pickedHouse = parentPickerHouses.find((h) => h.slug === noteHouseVal);
    note = pickedHouse ? `Married into ${entityLabel(pickedHouse)}` : "";
  }

  if (!name) {
    const err = document.getElementById("fError");
    err.textContent = "Please enter a name.";
    err.style.display = "block";
    return;
  }

  const payload = { name, role, parentId, spouseId, avatarUrl, buildLink, robloxProfile, discordId, note };

  try {
    if (editingMemberId) {
      await Api.updateMember(slug, editingMemberId, payload, sessionPassword);
    } else {
      await Api.addMember(slug, payload, sessionPassword);
    }
    closeModal();
    await refresh();
  } catch (e) {
    const err = document.getElementById("fError");
    err.textContent = e.message;
    err.style.display = "block";
  }
}

// Viewing any family tree — locked or not — now requires being signed in
// with Discord first. Rendered in place of the whole page, same footprint
// as a locked house's password gate, so there's nothing to peek at
// underneath. beginDiscordLogin() remembers this exact URL (including
// ?highlight=) and comes straight back here once signed in.
const DISCORD_GATE_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37a19.8 19.8 0 00-4.9-1.52.07.07 0 00-.08.04c-.21.38-.45.87-.61 1.26a18.3 18.3 0 00-5.48 0 12.6 12.6 0 00-.63-1.26.08.08 0 00-.08-.04 19.7 19.7 0 00-4.9 1.52.07.07 0 00-.03.03C1.24 9.05.47 13.58.83 18.06a.08.08 0 00.03.06 19.9 19.9 0 006 3.02.08.08 0 00.08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 00-.04-.11 13 13 0 01-1.88-.9.08.08 0 01-.01-.13c.13-.09.25-.19.37-.29a.07.07 0 01.08-.01c3.93 1.8 8.18 1.8 12.07 0a.08.08 0 01.08.01c.12.1.24.2.37.29a.08.08 0 010 .13c-.6.35-1.23.65-1.89.9a.08.08 0 00-.04.11c.37.7.78 1.37 1.23 2a.08.08 0 00.08.03 19.8 19.8 0 006.03-3.02.08.08 0 00.03-.06c.43-5.19-.72-9.68-3.05-13.66a.06.06 0 00-.03-.03zM8.52 15.3c-1.18 0-2.15-1.09-2.15-2.42 0-1.34.95-2.43 2.15-2.43 1.21 0 2.17 1.1 2.15 2.43 0 1.33-.95 2.42-2.15 2.42zm6.98 0c-1.18 0-2.15-1.09-2.15-2.42 0-1.34.95-2.43 2.15-2.43 1.21 0 2.17 1.1 2.15 2.43 0 1.33-.94 2.42-2.15 2.42z"/></svg>`;

function renderSignInGate() {
  document.title = "Sign in required · Family Tree";
  document.getElementById("houseHeader").innerHTML = "";
  document.getElementById("statusArea").innerHTML = `
    <div class="locked-card" style="--card-color:var(--gold)">
      <div class="lock-icon">${DISCORD_GATE_ICON}</div>
      <h3>Sign in to view this house</h3>
      <p>Family trees are only visible to signed-in visitors. Sign in with Discord to keep going.</p>
      <button class="btn btn-primary" id="houseSignInBtn">Sign in with Discord</button>
    </div>
  `;
  document.getElementById("treeArea").innerHTML = "";
  document.getElementById("houseSignInBtn").onclick = () => beginDiscordLogin();
}

if (typeof getDiscordUser === "function" && getDiscordUser()) {
  document.getElementById("treeArea").innerHTML = '<div class="tree-panel"><div class="skeleton-line">Loading house…</div></div>';
  refresh().catch(() => {
    document.querySelector("main").innerHTML =
      '<p style="color:#9a9a9e">House not found. <a href="/" style="color:#e0483e">Go back</a>.</p>';
  });
} else {
  renderSignInGate();
}
