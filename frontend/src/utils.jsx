export function initials(name) {
  return (name || "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  } catch (e) {
    return iso;
  }
}

export const STATUS_LABELS = {
  draft: "Draft",
  extracting: "Extracting",
  review: "Needs review",
  completed: "Completed",
  failed: "Failed",
};

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] || status}</span>;
}

export function RolePill({ role }) {
  return <span className={`role-pill role-${role}`}>{role}</span>;
}
