import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { useToast } from "../ToastContext.jsx";
import { Icon } from "../components/Icon.jsx";

const STEP_LABELS = ["Template", "Documents", "Extracting", "Review", "Done"];

function Stepper({ step }) {
  return (
    <div className="stepper">
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const cls = n < step ? "done" : n === step ? "active" : "";
        return (
          <React.Fragment key={label}>
            <div className={`step-pill ${cls}`}>
              <div className="step-num">{n < step ? "✓" : n}</div>
              {label}
            </div>
            {i < STEP_LABELS.length - 1 && <div className="step-connector" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function NewReport() {
  const [step, setStep] = useState(1);
  const [templates, setTemplates] = useState([]);
  const [pickedTemplateId, setPickedTemplateId] = useState(null);
  const [reportName, setReportName] = useState("");
  const [reportId, setReportId] = useState(null);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    api.templates.list().then(setTemplates);
  }, []);

  async function handleStep1Continue() {
    if (!pickedTemplateId) return toast("Choose a template", "error");
    if (!reportName.trim()) return toast("Give this report a name", "error");
    setBusy(true);
    try {
      const report = await api.reports.create(pickedTemplateId, reportName);
      setReportId(report.id);
      setStep(2);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  function addFiles(list) {
    setFiles((prev) => [...prev, ...list]);
  }

  async function handleStep2Continue() {
    setBusy(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      await api.reports.uploadDocuments(reportId, fd);
      await api.reports.extract(reportId);
      navigate(`/reports/${reportId}`);
    } catch (err) {
      toast(err.message, "error");
      setBusy(false);
    }
  }

  return (
    <div>
      {step === 1 && (
        <>
          <div className="page-head">
            <h1>New report</h1>
            <p>Pick the template this report should be filled into.</p>
          </div>
          <Stepper step={step} />
          {templates.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <Icon.Templates width={40} height={40} style={{ opacity: 0.5, marginBottom: 12 }} />
                <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>No templates yet</div>
                <div style={{ fontSize: 13, marginBottom: 16 }}>
                  Upload a template first — its placeholders become the fields we extract.
                </div>
                <button className="btn btn-primary" onClick={() => navigate("/templates")}>
                  Upload a template
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {templates.map((t) => (
                  <label key={t.id} className="card card-pad" style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}>
                    <input
                      type="radio"
                      name="tpl-pick"
                      value={t.id}
                      checked={pickedTemplateId === t.id}
                      onChange={() => setPickedTemplateId(t.id)}
                      style={{ width: 16, height: 16 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                        {t.fields.length} fields detected · {t.original_filename}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="form-row" style={{ marginTop: 20 }}>
                <label className="field-label">Report name</label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar — Motor Claim, July 2026"
                />
              </div>
              <button className="btn btn-primary" disabled={busy} onClick={handleStep1Continue}>
                {busy ? <span className="spinner on-dark" /> : "Continue"}
              </button>
            </>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <div className="page-head">
            <h1>Upload documents</h1>
            <p>Policy documents, medical bills, ID cards, claim forms — drop them all in, mixed together.</p>
          </div>
          <Stepper step={step} />
          <div className="card card-pad">
            <div
              className={`dropzone ${dragging ? "drag" : ""}`}
              onClick={() => fileInputRef.current.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles([...e.dataTransfer.files]); }}
            >
              <Icon.Upload width={32} height={32} style={{ marginBottom: 10, color: "var(--ink-soft)" }} />
              <div className="dropzone-title">Drop documents here</div>
              <div className="dropzone-sub">PDF, JPG, PNG — as many as this claim needs</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                multiple
                style={{ display: "none" }}
                onChange={(e) => addFiles([...e.target.files])}
              />
            </div>
            {files.map((f, i) => (
              <div key={i} className="file-row">
                <div className="file-icon">{(f.name.split(".").pop() || "").slice(0, 4).toUpperCase()}</div>
                <div className="file-name">{f.name}</div>
                <button className="file-remove" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}>
                  ×
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button>
              <button className="btn btn-primary" disabled={files.length === 0 || busy} onClick={handleStep2Continue}>
                {busy ? <span className="spinner on-dark" /> : "Upload & start extraction"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
