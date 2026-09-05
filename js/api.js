const API_BASE = "/api";

async function apiFetch(path, { method = "GET", body, headers = {} } = {}) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const finalHeaders = isFormData ? headers : { "Content-Type": "application/json", ...headers };

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
  getHouse: (slug) => apiFetch(`/houses/${slug}`),
  unlockHouse: (slug, password) => apiFetch(`/houses/${slug}/unlock`, { method: "POST", body: { password } }),
  lockHouse: (slug, password) => apiFetch(`/houses/${slug}/lock`, { method: "POST", body: { password } }),
  forgotPassword: (slug, secret) =>
    apiFetch(`/houses/${slug}/forgot-password`, { method: "POST", headers: { "x-admin-secret": secret } }),
  addMember: (slug, member) => apiFetch(`/houses/${slug}/members`, { method: "POST", body: member }),
  updateMember: (slug, id, member) => apiFetch(`/houses/${slug}/members/${id}`, { method: "PATCH", body: member }),
  removeMember: (slug, id) => apiFetch(`/houses/${slug}/members/${id}`, { method: "DELETE" }),
  resetAll: (secret) => apiFetch("/admin/reset", { method: "POST", headers: { "x-admin-secret": secret } }),
  submitApplication: (formData) => apiFetch("/applications", { method: "POST", body: formData })
};
