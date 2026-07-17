const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

async function request(path, { method = "GET", body, isForm = false } = {}) {
  const headers = {};
  if (!isForm && body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no body */
  }
  if (!res.ok) throw new Error((data && data.detail) || `Request failed (${res.status})`);
  return data;
}

export async function downloadReport(reportId, filename) {
  const res = await fetch(`${API_BASE}/reports/${reportId}/download`, { credentials: "include" });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  requestLink: (email, fullName) => request("/auth/request-link", { method: "POST", body: { email, fullName } }),
  me: () => request("/auth/me"),
  logout: () => request("/auth/logout", { method: "POST" }),

  templates: {
    list: () => request("/templates"),
    upload: (formData) => request("/templates/upload", { method: "POST", body: formData, isForm: true }),
  },

  reports: {
    list: (scope) => request(`/reports${scope ? `?scope=${scope}` : ""}`),
    get: (id) => request(`/reports/${id}`),
    create: (templateId, name) => request("/reports", { method: "POST", body: { template_id: templateId, name } }),
    uploadDocuments: (id, formData) =>
      request(`/reports/${id}/documents`, { method: "POST", body: formData, isForm: true }),
    extract: (id) => request(`/reports/${id}/extract`, { method: "POST" }),
    updateFields: (id, fields) => request(`/reports/${id}/fields`, { method: "PATCH", body: { fields } }),
    generate: (id) => request(`/reports/${id}/generate`, { method: "POST" }),
  },

  admin: {
    users: () => request("/admin/users"),
    updateRole: (id, role) => request(`/admin/users/${id}/role`, { method: "PATCH", body: { role } }),
    stats: () => request("/admin/stats"),
  },
};
