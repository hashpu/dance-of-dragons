/* ---------------------------------------------------------------
   Dialog — themed replacements for window.prompt/confirm/alert,
   built from the same .modal/.modal-overlay styling the member-
   editor modal already uses. Self-contained: builds its own
   overlay and appends it to <body>, so it works on any page
   without needing a #modalRoot element.
------------------------------------------------------------------ */
const Dialog = (() => {
  const ICONS = {
    lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a1.5 1.5 0 001.29 2.25h17.78a1.5 1.5 0 001.29-2.25L13.71 3.86a1.5 1.5 0 00-2.42 0z"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`,
    discord: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.32 4.37a19.8 19.8 0 00-4.9-1.52.07.07 0 00-.08.04c-.21.38-.45.87-.61 1.26a18.3 18.3 0 00-5.48 0 12.6 12.6 0 00-.63-1.26.08.08 0 00-.08-.04 19.7 19.7 0 00-4.9 1.52.07.07 0 00-.03.03C1.24 9.05.47 13.58.83 18.06a.08.08 0 00.03.06 19.9 19.9 0 006 3.02.08.08 0 00.08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 00-.04-.11 13 13 0 01-1.88-.9.08.08 0 01-.01-.13c.13-.09.25-.19.37-.29a.07.07 0 01.08-.01c3.93 1.8 8.18 1.8 12.07 0a.08.08 0 01.08.01c.12.1.24.2.37.29a.08.08 0 010 .13c-.6.35-1.23.65-1.89.9a.08.08 0 00-.04.11c.37.7.78 1.37 1.23 2a.08.08 0 00.08.03 19.8 19.8 0 006.03-3.02.08.08 0 00.03-.06c.43-5.19-.72-9.68-3.05-13.66a.06.06 0 00-.03-.03zM8.52 15.3c-1.18 0-2.15-1.09-2.15-2.42 0-1.34.95-2.43 2.15-2.43 1.21 0 2.17 1.1 2.15 2.43 0 1.33-.95 2.42-2.15 2.42zm6.98 0c-1.18 0-2.15-1.09-2.15-2.42 0-1.34.95-2.43 2.15-2.43 1.21 0 2.17 1.1 2.15 2.43 0 1.33-.94 2.42-2.15 2.42z"/></svg>`
  };

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function shell({ kicker, title, message, bodyHtml, icon, cardColor }) {
    return el(`
      <div class="modal-overlay dialog-overlay">
        <div class="modal" style="--card-color:${cardColor}">
          <div class="modal-header">
            <div class="modal-crest">${ICONS[icon] || ICONS.info}</div>
            <div>
              ${kicker ? `<div class="modal-kicker">${kicker}</div>` : ""}
              <h3>${title}</h3>
            </div>
          </div>
          ${message ? `<p class="dialog-message">${message}</p>` : ""}
          ${bodyHtml || ""}
        </div>
      </div>
    `);
  }

  function mount(overlay, { onCancel }) {
    document.body.appendChild(overlay);
    document.body.classList.add("dialog-open");

    function cleanup() {
      overlay.remove();
      document.body.classList.remove("dialog-open");
      document.removeEventListener("keydown", onKeydown);
    }

    function onKeydown(e) {
      if (e.key === "Escape") {
        cleanup();
        onCancel();
      }
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        cleanup();
        onCancel();
      }
    });
    document.addEventListener("keydown", onKeydown);

    return cleanup;
  }

  function prompt({
    title,
    kicker = "",
    message = "",
    label = "",
    placeholder = "",
    value = "",
    type = "text",
    confirmText = "OK",
    cancelText = "Cancel",
    icon = "lock",
    cardColor = "var(--gold, #d4af37)"
  }) {
    return new Promise((resolve) => {
      const overlay = shell({
        kicker,
        title,
        message,
        icon,
        cardColor,
        bodyHtml: `
          <div class="field">
            ${label ? `<label>${label}</label>` : ""}
            <div class="input-wrap">
              ${(ICONS[icon] || ICONS.lock).replace("<svg ", '<svg class="field-icon" ')}
              <input id="dialogInput" type="${type}" placeholder="${placeholder}" value="${value}" autocomplete="off" />
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" id="dialogCancel">${cancelText}</button>
            <button type="button" class="btn btn-primary" id="dialogConfirm">${confirmText}</button>
          </div>
        `
      });

      const cleanup = mount(overlay, { onCancel: () => resolve(null) });
      const input = overlay.querySelector("#dialogInput");

      function confirm() {
        const val = input.value;
        cleanup();
        resolve(val);
      }

      overlay.querySelector("#dialogConfirm").onclick = confirm;
      overlay.querySelector("#dialogCancel").onclick = () => {
        cleanup();
        resolve(null);
      };
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") confirm();
      });

      input.focus();
    });
  }

  // Search-and-pick from a live-queried list, instead of typing a raw
  // value — e.g. picking a Discord account to assign as a house's Lord from
  // only the accounts that have actually signed in on the site before.
  // Resolves the chosen row's object, { manual: true } if the manual-entry
  // escape hatch was used (only offered when allowManual is set — the list
  // is meant to be the only path for some callers, like Lord assignment),
  // or null if cancelled.
  function search({
    title,
    kicker = "",
    message = "",
    placeholder = "Search by Discord username…",
    cancelText = "Cancel",
    icon = "discord",
    cardColor = "var(--gold, #d4af37)",
    fetchResults, // async (query) => [{ id, username, avatar }]
    allowManual = false,
    manualLabel = "Can't find them? Enter details manually"
  }) {
    return new Promise((resolve) => {
      const overlay = shell({
        kicker,
        title,
        message,
        icon,
        cardColor,
        bodyHtml: `
          <div class="field">
            <div class="input-wrap">
              <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
              <input id="dialogSearchInput" type="text" placeholder="${placeholder}" autocomplete="off" />
            </div>
          </div>
          <div class="dialog-search-results" id="dialogSearchResults"></div>
          ${allowManual ? `<button type="button" class="btn-link" id="dialogManual">${manualLabel}</button>` : ""}
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" id="dialogCancel">${cancelText}</button>
          </div>
        `
      });

      const cleanup = mount(overlay, { onCancel: () => resolve(null) });

      if (allowManual) {
        overlay.querySelector("#dialogManual").onclick = () => {
          cleanup();
          resolve({ manual: true });
        };
      }
      const input = overlay.querySelector("#dialogSearchInput");
      const resultsEl = overlay.querySelector("#dialogSearchResults");

      function rowHtml(user) {
        const avatarUrl = typeof discordAvatarUrl === "function" ? discordAvatarUrl(user) : "";
        return `
          <button type="button" class="member-hit dialog-search-row" data-id="${user.id}">
            <img src="${avatarUrl}" alt="" />
            <span class="member-hit-name">${user.username}</span>
          </button>
        `;
      }

      // Guards against an in-flight search from an earlier keystroke
      // resolving after a newer one and clobbering fresher results.
      let requestId = 0;
      async function runSearch(query) {
        const thisRequest = ++requestId;
        resultsEl.innerHTML = `<div class="dialog-search-status">Searching…</div>`;
        let users;
        try {
          users = await fetchResults(query);
        } catch (e) {
          if (thisRequest !== requestId) return;
          resultsEl.innerHTML = `<div class="dialog-search-status">Couldn't load results.</div>`;
          return;
        }
        if (thisRequest !== requestId) return;
        if (!users.length) {
          resultsEl.innerHTML = `<div class="dialog-search-status">${query ? "No one matches yet." : "Nobody's signed in yet."} They need to sign in with Discord on the site at least once first.</div>`;
          return;
        }
        resultsEl.innerHTML = users.map(rowHtml).join("");
        resultsEl.querySelectorAll(".dialog-search-row").forEach((btn) => {
          btn.onclick = () => {
            const user = users.find((u) => u.id === btn.dataset.id);
            cleanup();
            resolve(user);
          };
        });
      }

      let debounceTimer = null;
      input.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => runSearch(input.value.trim()), 250);
      });

      overlay.querySelector("#dialogCancel").onclick = () => {
        cleanup();
        resolve(null);
      };

      runSearch("");
      input.focus();
    });
  }

  function confirmDialog({
    title,
    kicker = "",
    message = "",
    confirmText = "Confirm",
    cancelText = "Cancel",
    danger = false,
    icon = "warning",
    cardColor
  }) {
    cardColor = cardColor || (danger ? "var(--red)" : "var(--gold, #d4af37)");
    return new Promise((resolve) => {
      const overlay = shell({
        kicker,
        title,
        message,
        icon,
        cardColor,
        bodyHtml: `
          <div class="modal-actions">
            <button type="button" class="btn btn-outline" id="dialogCancel">${cancelText}</button>
            <button type="button" class="btn ${danger ? "btn-danger-outline" : "btn-primary"}" id="dialogConfirm">${confirmText}</button>
          </div>
        `
      });

      const cleanup = mount(overlay, { onCancel: () => resolve(false) });
      overlay.querySelector("#dialogConfirm").onclick = () => {
        cleanup();
        resolve(true);
      };
      overlay.querySelector("#dialogCancel").onclick = () => {
        cleanup();
        resolve(false);
      };
      overlay.querySelector("#dialogConfirm").focus();
    });
  }

  function alertDialog({ title, kicker = "", message = "", okText = "OK", icon = "info", cardColor = "var(--gold, #d4af37)" }) {
    return new Promise((resolve) => {
      const overlay = shell({
        kicker,
        title,
        message,
        icon,
        cardColor,
        bodyHtml: `
          <div class="modal-actions">
            <button type="button" class="btn btn-primary" id="dialogOk">${okText}</button>
          </div>
        `
      });

      const cleanup = mount(overlay, { onCancel: () => resolve() });
      overlay.querySelector("#dialogOk").onclick = () => {
        cleanup();
        resolve();
      };
      overlay.querySelector("#dialogOk").focus();
    });
  }

  return { prompt, confirm: confirmDialog, alert: alertDialog, search };
})();
