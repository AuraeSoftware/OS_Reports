import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../AuthContext.jsx";
import { Icon } from "../components/Icon.jsx";
import { StatusBadge, fmtDate } from "../utils.jsx";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "extracting", label: "Extracting" },
  { key: "review", label: "Needs review" },
  { key: "completed", label: "Completed" },
  { key: "failed", label: "Failed" },
];

export default function Dashboard() {
  const { isStaff } = useAuth();
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.reports
      .list(isStaff ? "all" : undefined)
      .then(setReports)
      .finally(() => setLoading(false));
  }, [isStaff]);

  const visible = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  return (
    <>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1>{isStaff ? "Team Reports" : "Reports"}</h1>
          <p>{isStaff ? "Every report across OS2 Studio, in one queue." : "Every claim pack you've processed, in one place."}</p>
        </div>
        <Link to="/new-report" className="btn btn-primary">
          <Icon.Plus width={16} height={16} /> New report
        </Link>
      </div>
      <div className="filter-row">
        {FILTERS.map((f) => (
          <button key={f.key} className={`filter-chip ${filter === f.key ? "active" : ""}`} onClick={() => setFilter(f.key)}>
            {f.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <span className="spinner" />
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Icon.Empty width={40} height={40} style={{ opacity: 0.5, marginBottom: 12 }} />
            <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>No reports here</div>
            <div style={{ fontSize: 13 }}>
              {filter === "all" ? "Upload a template and your first set of documents to get started." : "Nothing matches this filter yet."}
            </div>
          </div>
        </div>
      ) : (
        visible.map((r) => (
          <Link key={r.id} to={`/reports/${r.id}`} className="report-row">
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Icon.Doc width={18} height={18} />
            </div>
            <div className="report-meta">
              <div className="report-name">{r.name}</div>
              <div className="report-date">
                {fmtDate(r.created_at)} · {r.documents.length} document{r.documents.length === 1 ? "" : "s"}
              </div>
            </div>
            {isStaff && r.owner_name && <span className="owner-chip">{r.owner_name}</span>}
            <StatusBadge status={r.status} />
          </Link>
        ))
      )}
    </>
  );
}
