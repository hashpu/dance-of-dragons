const API_BASE = "/api";

async function apiFetch(path, { method = "GET", body, headers = {}, housePassword } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const finalHeaders = isFormData ? { ...headers } : { "Content-Type": "application/json", ...headers };

  // Proves the visitor entered a locked house's password this page visit —
  // kept only in page memory (see tree.js), never persisted, so it stops
  // applying the moment they leave or reload.
  if (housePassword) finalHeaders["x-house-password"] = housePassword;

  // Lets the server recognize a signed-in Discord+Roblox "Lord" for house-editing checks.
  const discordToken = typeof getDiscordAccessToken === "function" ? getDiscordAccessToken() : null;
  if (discordToken && !finalHeaders.Authorization) {
    finalHeaders.Authorization = "Bearer " + discordToken;
  }
  const robloxToken = typeof getRobloxAccessToken === "function" ? getRobloxAccessToken() : null;
  if (robloxToken && !finalHeaders["X-Roblox-Token"]) {
    finalHeaders["X-Roblox-Token"] = robloxToken;
  }

  const res = await fetch(API_BASE + path, {
    method,
    headers: finalHeaders,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body)
  });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

const Api = {
  getHouses: () => apiFetch("/houses"),
  getHouse: (slug, housePassword) => apiFetch(`/houses/${slug}`, { housePassword }),
  unlockHouse: (slug, password) => apiFetch(`/houses/${slug}/unlock`, { method: "POST", body: { password } }),
  lockHouse: (slug, password) => apiFetch(`/houses/${slug}/lock`, { method: "POST", body: { password } }),
  forgotPassword: (slug, secret) =>
    apiFetch(`/houses/${slug}/forgot-password`, { method: "POST", headers: { "x-admin-secret": secret } }),
  addMember: (slug, member, housePassword) => apiFetch(`/houses/${slug}/members`, { method: "POST", body: member, housePassword }),
  updateMember: (slug, id, member, housePassword) =>
    apiFetch(`/houses/${slug}/members/${id}`, { method: "PATCH", body: member, housePassword }),
  removeMember: (slug, id, housePassword) => apiFetch(`/houses/${slug}/members/${id}`, { method: "DELETE", housePassword }),
  uploadAvatar: (slug, file, housePassword) => {
    const formData = new FormData();
    formData.append("avatar", file);
    return apiFetch(`/houses/${slug}/avatar`, { method: "POST", body: formData, housePassword });
  },
  resetAll: (secret) => apiFetch("/admin/reset", { method: "POST", headers: { "x-admin-secret": secret } }),
  setLordRole: (slug, roleId, robloxUsername, secret) =>
    apiFetch(`/houses/${slug}/lord-role`, {
      method: "POST",
      body: { roleId, robloxUsername },
      headers: { "x-admin-secret": secret }
    }),
  setLordDiscordId: (slug, discordUserId, secret) =>
    apiFetch(`/houses/${slug}/lord-discord`, {
      method: "POST",
      body: { discordUserId },
      headers: { "x-admin-secret": secret }
    }),
  submitApplication: (formData) => apiFetch("/applications", { method: "POST", body: formData }),
  getVotes: () => apiFetch("/votes"),
  castVote: (choice) => apiFetch("/votes", { method: "POST", body: { choice } })
};
