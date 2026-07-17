import React, { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";
import { useToast } from "../ToastContext.jsx";
import { Icon } from "../components/Icon.jsx";

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const toast = useToast();

  function load() {
    api.templates.list().then(setTemplates);
  }
  useEffect(load, []);

  async function handleUpload() {
    if (!name.trim()) return toast("Give the template a name first", "error");
    if (!file) return toast("Choose a .docx file", "error");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", name);
      fd.append("file", file);
      await api.templates.upload(fd);
      toast("Template uploaded and fields detected", "success");
      setName("");
      setFile(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Templates</h1>
        <p>Word templates with {"{{tag}}"} or "Label:" placeholders detected automatically.</p>
      </div>
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <label className="field-label">Template name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Motor Claim Settlement Form"
          style={{ marginBottom: 14 }}
        />
        <div
          className={`dropzone ${dragging ? "drag" : ""}`}
          onClick={() => fileInputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
        >
          <Icon.Upload width={32} height={32} style={{ marginBottom: 10, color: "var(--ink-soft)" }} />
          <div className="dropzone-title">Drop a .docx template here</div>
          <div className="dropzone-sub">or click to browse — placeholders are detected on upload</div>
          <input ref={fileInputRef} type="file" accept=".docx" className="hidden" style={{ display: "none" }} onChange={(e) => e.target.files[0] && setFile(e.target.files[0])} />
        </div>
        {file && (
          <div className="file-row">
            <div className="file-icon">DOCX</div>
            <div className="file-name">{file.name}</div>
          </div>
        )}
        <button className="btn btn-dark" style={{ marginTop: 14 }} disabled={uploading} onClick={handleUpload}>
          {uploading ? <span className="spinner on-dark" /> : "Upload & detect fields"}
        </button>
      </div>
      {templates.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Icon.Templates width={40} height={40} style={{ opacity: 0.5, marginBottom: 12 }} />
            <div>No templates uploaded yet</div>
          </div>
        </div>
      ) : (
        templates.map((t) => (
          <div key={t.id} className="card card-pad" style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{t.original_filename}</div>
              </div>
              <span className="badge badge-review">{t.fields.length} fields</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {t.fields.slice(0, 8).map((f) => (
                <span key={f.key} className="source-chip">{f.label}</span>
              ))}
              {t.fields.length > 8 && <span className="source-chip">+{t.fields.length - 8} more</span>}
            </div>
          </div>
        ))
      )}
    </>
  );
}
