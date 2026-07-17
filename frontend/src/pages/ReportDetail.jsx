import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, downloadReport } from "../api/client.js";
import { useAuth } from "../AuthContext.jsx";
import { useToast } from "../ToastContext.jsx";
import { Icon } from "../components/Icon.jsx";
import { StatusBadge, fmtDate } from "../utils.jsx";

export default function ReportDetail() {
  const { id } = useParams();
  const { isStaff } = useAuth();
  const [report, setReport] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const [saving, setSaving] = useState(false);
  const pollRef = useRef(null);
  const toast = useToast();

  async function load() {
    try {
      const data = await api.reports.get(id);
      setReport(data);
      const initialValues = {};
      Object.entries(data.merged_data || {}).forEach(([key, v]) => {
        initialValues[key] = v.value ?? "";
      });
      setFieldValues(initialValues);
      return data;
    } catch (err) {
      toast(err.message, "error");
    }
  }

  useEffect(() => {
    load();
    return () => clearInterval(pollRef.current);
  }, [id]);

  useEffect(() => {
    clearInterval(pollRef.current);
    if (report?.status === "extracting") {
      pollRef.current = setInterval(load, 2500);
    }
    return () => clearInterval(pollRef.current);
  }, [report?.status]);

  async function handleGenerate() {
    setSaving(true);
    try {
      await api.reports.updateFields(id, fieldValues);
      const updated = await api.reports.generate(id);
      setReport(updated);
      toast("Document generated", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  if (!report) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1>{report.name}</h1>
          <p>
            {fmtDate(report.created_at)}
            {isStaff && report.owner_name ? ` · ${report.owner_name}` : ""}
          </p>
        </div>
        <StatusBadge status={report.status} />
      </div>

      {(report.status === "draft" || report.status === "extracting") && (
        <div className="scan-card">
          <div className="scan-title">{report.status === "draft" ? "Waiting to start" : "Reading your documents…"}</div>
          <div className="scan-sub">{report.documents.length} document{report.documents.length === 1 ? "" : "s"} · GPT-4o extraction</div>
          <div style={{ marginTop: 18 }}>
            {report.documents.map((d) => (
              <div key={d.id} className="scan-doc-row">
                <div className={`scan-dot ${d.status}`} />
                <span>{d.original_filename}</span>
                <span style={{ marginLeft: "auto", color: "#9A958F" }}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(report.status === "review" || report.status === "failed") && (
        <>
          {report.status === "failed" && (
            <div className="error-banner" style={{ marginBottom: 16 }}>
              {report.error_message || "Extraction failed for one or more documents."}
            </div>
          )}
          <div className="card card-pad">
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>Review extracted fields</h3>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 18 }}>
              Edit anything that looks off before generating the final document. The chip shows which upload a value came from.
            </p>
            <div className="field-grid">
              {Object.entries(report.merged_data || {}).map(([key, v]) => (
                <div key={key} className="field-card">
                  <div className="field-card-top">
                    <span className="field-name">{key.replace(/_/g, " ")}</span>
                    <span className={`source-chip ${!v.source ? "empty" : ""}`}>{v.source || "not found"}</span>
                  </div>
                  <input
                    type="text"
                    value={fieldValues[key] ?? ""}
                    placeholder="—"
                    onChange={(e) => setFieldValues((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ marginTop: 20 }} disabled={saving} onClick={handleGenerate}>
              {saving ? <span className="spinner on-dark" /> : "Save & generate document"}
            </button>
          </div>
        </>
      )}

      {report.status === "completed" && (
        <div className="card card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--lime-soft)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", color: "#5A7300" }}>
            <Icon.Download width={24} height={24} />
          </div>
          <h3 style={{ marginBottom: 6 }}>Document generated</h3>
          <p style={{ color: "var(--ink-soft)", fontSize: 13, marginBottom: 20 }}>The template has been filled and is ready to download.</p>
          <button className="btn btn-primary" onClick={() => downloadReport(report.id, report.name)}>
            Download .docx
          </button>
        </div>
      )}
    </>
  );
}
