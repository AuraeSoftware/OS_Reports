import React, { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [needsName, setNeedsName] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "link_expired") {
      setError("That link has expired or was already used — request a new one below.");
    }
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.requestLink(email, needsName ? fullName : undefined);
      setSent(true);
    } catch (err) {
      if (err.message.includes("full name")) {
        setNeedsName(true);
        setError("Looks like this is your first sign-in — add your name and try again.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">OR</div>
          <div className="auth-brand-name">OS Reports</div>
        </div>
        <div className="card card-pad">
          {error && <div className="error-banner">{error}</div>}
          {sent ? (
            <div className="success-banner">
              Check <strong>{email}</strong> for a sign-in link. It expires in 15 minutes.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {needsName && (
                <div className="form-row">
                  <label className="field-label">Full name</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" required />
                </div>
              )}
              <div className="form-row">
                <label className="field-label">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@os2studio.com" required />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? <span className="spinner on-dark" /> : "Send sign-in link"}
              </button>
            </form>
          )}
        </div>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--ink-soft)", marginTop: 16 }}>
          OS2 Studio internal tool · insurance document autofill · no password needed
        </p>
      </div>
    </div>
  );
}
