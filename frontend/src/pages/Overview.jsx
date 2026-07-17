import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

export default function Overview() {
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.admin.stats().then(setStats).catch(() => {});
  }, []);

  return (
    <>
      <div className="page-head">
        <h1>Overview</h1>
        <p>Org-wide snapshot across every user's reports.</p>
      </div>
      <div className="stat-grid">
        <div className="stat-card accent">
          <div className="stat-value">{stats?.total_reports ?? "—"}</div>
          <div className="stat-label">Total reports</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.reports_pending_review ?? "—"}</div>
          <div className="stat-label">Needs review</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.reports_completed ?? "—"}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.total_users ?? "—"}</div>
          <div className="stat-label">Team members</div>
        </div>
      </div>
      <div className="card card-pad" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{stats?.reports_this_month ?? 0} reports created this month</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Jump into the team queue to review what's pending.</div>
        </div>
        <button className="btn btn-dark" onClick={() => navigate("/dashboard")}>
          View team reports
        </button>
      </div>
    </>
  );
}
