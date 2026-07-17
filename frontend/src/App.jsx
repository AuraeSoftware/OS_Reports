import React, { useEffect } from "react";
import { Routes, Route, Navigate, useSearchParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { ToastProvider } from "./ToastContext.jsx";
import Shell from "./components/Shell.jsx";
import Login from "./pages/Login.jsx";
import Overview from "./pages/Overview.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Templates from "./pages/Templates.jsx";
import NewReport from "./pages/NewReport.jsx";
import ReportDetail from "./pages/ReportDetail.jsx";
import Users from "./pages/Users.jsx";

function SignedInRefresh() {
  // after the magic-link redirect (?signed_in=1) the session cookie is already
  // set - just re-fetch /me so the app picks up the new session
  const { refresh } = useAuth();
  const [params] = useSearchParams();
  useEffect(() => {
    if (params.get("signed_in")) refresh();
  }, [params]);
  return null;
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <span className="spinner" />
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function RequireAdmin({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "40vh 0" }}>
        <span className="spinner" />
      </div>
    );
  }

  return (
    <>
      <SignedInRefresh />
      <Routes>
        <Route path="/" element={user ? <Navigate to={user.role === "admin" ? "/overview" : "/dashboard"} replace /> : <Login />} />
        <Route
          element={
            <RequireAuth>
              <Shell />
            </RequireAuth>
          }
        >
          <Route
            path="/overview"
            element={
              <RequireAdmin>
                <Overview />
              </RequireAdmin>
            }
          />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/new-report" element={<NewReport />} />
          <Route path="/reports/:id" element={<ReportDetail />} />
          <Route
            path="/users"
            element={
              <RequireAdmin>
                <Users />
              </RequireAdmin>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}
