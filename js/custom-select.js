/* Shared "floating dropdown" infrastructure, used by both tree.js's avatar-
   list person-picker and wireCustomSelect below (themed replacement for a
   plain <select>, since the browser's own OS-styled popup can't be
   restyled). Split into its own file so pages that only need the plain
   select version (e.g. apply.js) don't have to load all of tree.js. */

function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}

function elFromHtml(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// Currently-open floating dropdowns (their control objects), for the single
// shared outside-click handler below. A dropdown adds itself on open and
// removes itself on close, so this only ever holds what's actually on
// screen right now.
const openPersonPickers = new Set();

// Closes any open dropdown's floating panel when a click lands outside both
// its trigger and its panel. Registered once (module scope, guarded by the
// flag below) rather than once per wire*() call, since a page can re-wire
// fresh pickers/selects any number of times over its lifetime.
let personPickerOutsideClickWired = false;
function ensurePersonPickerOutsideClickHandling() {
  if (personPickerOutsideClickWired) return;
  personPickerOutsideClickWired = true;
  document.addEventListener("click", (e) => {
    // Copy to an array first — a picker's close() mutates openPersonPickers
    // mid-iteration otherwise, which Set#forEach handles fine per spec, but
    // this is clearer to read as "decide, then act."
    [...openPersonPickers].forEach((picker) => {
      if (!picker.containsTarget(e.target)) picker.close();
    });
  });
}

// Hides a real <select> (kept as the source of truth via .value and a
// dispatched synthetic "change" event) behind a themed trigger+panel built
// from the select's own <option>/<optgroup> DOM.
function wireCustomSelect(selectId) {
  const select = document.getElementById(selectId);
  const wrap = select.closest(".input-wrap");
  wrap.classList.add("person-picker-trigger");
  wrap.setAttribute("role", "button");
  wrap.setAttribute("tabindex", "0");
  wrap.setAttribute("aria-haspopup", "listbox");
  wrap.setAttribute("aria-expanded", "false");

  const label = document.createElement("span");
  label.className = "person-picker-trigger-label";
  wrap.insertBefore(label, select);
  select.hidden = true;

  let panelEl = null;

  function renderLabel() {
    const opt = select.options[select.selectedIndex];
    label.textContent = opt ? opt.textContent : "";
  }

  function rowHtml(opt) {
    return `<button type="button" class="person-picker-row${opt.value === select.value ? " active" : ""}" data-value="${escapeAttr(opt.value)}">${opt.textContent}</button>`;
  }
  function renderRows() {
    let html = "";
    Array.from(select.children).forEach((child) => {
      if (child.tagName === "OPTGROUP") {
        html += `<div class="custom-select-group-label">${child.label}</div>`;
        Array.from(child.children).forEach((opt) => (html += rowHtml(opt)));
      } else if (child.tagName === "OPTION") {
        html += rowHtml(child);
      }
    });
    return html;
  }

  function position() {
    const r = wrap.getBoundingClientRect();
    panelEl.style.left = `${r.left}px`;
    panelEl.style.top = `${r.bottom + 6}px`;
    panelEl.style.width = `${r.width}px`;
  }
  function repositionIfOpen() {
    if (panelEl) position();
  }

  function open() {
    if (panelEl) return;
    wrap.setAttribute("aria-expanded", "true");
    panelEl = elFromHtml(`<div class="person-picker-panel"><div class="person-picker-list">${renderRows()}</div></div>`);
    document.body.appendChild(panelEl);
    position();
    panelEl.querySelectorAll(".person-picker-row").forEach((row) => {
      row.onclick = () => {
        select.value = row.dataset.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        renderLabel();
        close();
        wrap.focus();
      };
    });
    window.addEventListener("resize", repositionIfOpen);
    window.addEventListener("scroll", repositionIfOpen, true);
    openPersonPickers.add(control);
  }
  function close() {
    if (!panelEl) return;
    panelEl.remove();
    panelEl = null;
    wrap.setAttribute("aria-expanded", "false");
    window.removeEventListener("resize", repositionIfOpen);
    window.removeEventListener("scroll", repositionIfOpen, true);
    openPersonPickers.delete(control);
  }

  wrap.addEventListener("click", () => (panelEl ? close() : open()));
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      panelEl ? close() : open();
    } else if (e.key === "Escape") {
      close();
    }
  });
  ensurePersonPickerOutsideClickHandling();
  renderLabel();

  const control = { containsTarget: (target) => wrap.contains(target) || (panelEl && panelEl.contains(target)), close };
  return control;
}
